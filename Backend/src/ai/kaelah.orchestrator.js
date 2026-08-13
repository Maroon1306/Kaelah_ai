import { pool } from '../db/pool.js'
import { getOpenAIClient, OPENAI_MODEL } from './openai.client.js'
import { TOOL_SCHEMAS, findTool } from './tools.js'
import { getToolProvider, getToolFeature } from './toolAccess.js'
import { getPlanLimits, planHasFeature } from '../config/plans.js'
import { HttpError } from '../middleware/errorHandler.js'
import * as conversations from '../modules/conversations/conversations.service.js'
import * as actionsService from '../modules/conversations/actions.service.js'

async function getConnectedProviders(companyId) {
  const { rows } = await pool.query(
    "SELECT provider FROM connectors WHERE company_id = $1 AND status = 'connected'",
    [companyId]
  )
  return rows.map((r) => r.provider)
}

/**
 * Only sends the model tool definitions it can actually use: connector
 * tools for platforms this company hasn't connected are pure token cost
 * with zero chance of being called. This is the single biggest lever on
 * per-message OpenAI cost given how many connector tools exist. Paid
 * features (bulk actions, Search Console, the autonomous agent) are also
 * dropped here for plans that don't include them, so the model never
 * offers something the user can't actually use.
 */
function getAvailableToolSchemas(connectedProviders, plan) {
  const connected = new Set(connectedProviders)
  return TOOL_SCHEMAS.filter((schema) => {
    const name = schema.function.name
    const provider = getToolProvider(name)
    if (provider && !connected.has(provider)) return false
    const feature = getToolFeature(name)
    if (feature && !planHasFeature(plan, feature)) return false
    return true
  })
}

async function buildSystemPrompt(connected) {
  return `Tu es Kaelah, un assistant IA e-commerce conversationnel. Tu aides une entreprise à gérer son commerce, son SEO/GEO, sa relation client et ses automatisations en discutant simplement.

Connecteurs actuellement connectés pour cette entreprise: ${connected.length ? connected.join(', ') : 'aucun'}.

Règles:
- Utilise toujours des données réelles via les outils disponibles. Ne jamais inventer de chiffres commerciaux (chiffre d'affaires, commandes, produits).
- Si un connecteur nécessaire n'est pas connecté, dis-le clairement et invite l'utilisateur à le connecter depuis les Paramètres plutôt que d'halluciner des données.
- Pour toute action qui modifie des données réelles (mise à jour de produit, de contenu, de SEO), n'exécute jamais directement : propose l'action, elle sera confirmée par l'utilisateur avant application.
- Pour tout titre SEO (meta title) : viser 50 à 60 caractères, jamais plus de 70. Pour toute meta description : 150 caractères maximum.
- Ne jamais mentionner le nom d'une plateforme technique (Shopify, WordPress, Drupal, WooCommerce...) dans un titre SEO ou une meta description généré — ce n'est pas professionnel et n'a aucune valeur pour l'utilisateur final. Le texte SEO doit parler du produit/contenu/entreprise, jamais de l'outil technique utilisé pour le gérer.
- Pour optimiser le SEO de la page d'accueil d'un site (par opposition à un produit/article/page précis), utilise toujours l'outil dédié à la page d'accueil de la plateforme concernée, jamais l'outil de mise à jour d'un contenu individuel avec une URL en guise de nom.
- Réponds en français sauf si l'utilisateur écrit en anglais.
- Sois concis et concret.`
}

function buildCardsFromToolResults(toolResults) {
  const cards = []
  for (const { name, result } of toolResults) {
    if (result?.error) continue
    if (name === 'get_shopify_products' && result.products) {
      cards.push({ type: 'products', data: result.products.map((p) => ({ id: String(p.id), name: p.title, price: p.price ? `${p.price} €` : '', image: p.image || null, suggestion: '' })) })
    }
    if (name === 'get_shopify_orders_summary' && result) {
      cards.push({ type: 'analytics', data: { revenue: result.revenue != null ? `${result.revenue} ${result.currency || ''}`.trim() : undefined, orders: result.ordersCount } })
    }
    if (name === 'analyze_seo_url' && result) {
      cards.push({ type: 'seo', data: { score: result.score, issues: result.issues?.length || 0, recommended: result.issues || [] } })
    }
  }
  return cards
}

export async function handleChatMessage({ companyId, plan, subscriptionStatus, autoActions = false, conversationId, text }) {
  const client = getOpenAIClient()
  if (!client) throw new HttpError(503, "OPENAI_API_KEY n'est pas configurée côté serveur — le chat ne peut pas répondre pour le moment.")

  // Every plan requires an active paid subscription — the frontend already
  // keeps unpaid accounts out of /chat entirely, this is defense-in-depth
  // for anyone hitting the API directly.
  if (subscriptionStatus !== 'active') {
    throw new HttpError(402, "Ton compte n'a pas encore de forfait actif. Choisis et paie un forfait dans Paramètres > Facturation pour commencer à discuter avec Kaelah.")
  }

  let conversation
  if (conversationId) {
    await conversations.assertOwnership(companyId, conversationId)
    conversation = { id: conversationId }
  } else {
    conversation = await conversations.createConversation(companyId, text)
  }

  await conversations.addMessage(conversation.id, 'user', text)

  const { messagesPerMonth } = getPlanLimits(plan)
  if (messagesPerMonth != null) {
    const used = await conversations.countMessagesThisMonth(companyId)
    if (used > messagesPerMonth) {
      const assistantMessage = await conversations.addMessage(
        conversation.id,
        'assistant',
        `Tu as atteint la limite de ${messagesPerMonth} messages ce mois-ci sur ton forfait actuel. Passe à un forfait supérieur dans Paramètres > Facturation pour continuer à discuter avec moi dès maintenant — ta limite sera remise à zéro le mois prochain sinon.`,
        {}
      )
      await conversations.touchConversation(conversation.id)
      return { conversationId: conversation.id, message: { ...assistantMessage, actions: [] } }
    }
  }

  const connected = await getConnectedProviders(companyId)
  const systemPrompt = await buildSystemPrompt(connected)
  const history = await conversations.getRecentHistory(conversation.id, 20)
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ]

  let completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages,
    tools: getAvailableToolSchemas(connected, plan),
    tool_choice: 'auto',
  })

  let responseMessage = completion.choices[0].message
  const toolResults = []
  const pendingActions = []

  if (responseMessage.tool_calls?.length) {
    const followUpMessages = [...messages, responseMessage]

    for (const call of responseMessage.tool_calls) {
      const tool = findTool(call.function.name)
      const args = JSON.parse(call.function.arguments || '{}')

      if (!tool) {
        followUpMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ error: 'unknown_tool' }) })
        continue
      }

      if (tool.mutating) {
        // Do not execute — hold for user confirmation.
        pendingActions.push({ functionName: call.function.name, arguments: args })
        followUpMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({ status: 'awaiting_confirmation', message: 'Action proposée, en attente de confirmation utilisateur.' }),
        })
        continue
      }

      const result = await tool.execute(args, { companyId })
      toolResults.push({ name: call.function.name, result })
      followUpMessages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
    }

    completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: followUpMessages,
    })
    responseMessage = completion.choices[0].message
  }

  const cards = buildCardsFromToolResults(toolResults)
  const assistantMessage = await conversations.addMessage(conversation.id, 'assistant', responseMessage.content || '', { cards })

  const savedActions = []
  for (const pending of pendingActions) {
    const action = await actionsService.createAction(assistantMessage.id, pending.functionName, pending.arguments)
    if (autoActions) {
      try {
        const { status, result } = await actionsService.confirmAction(action.id, companyId)
        savedActions.push({ ...action, status, result })
        continue
      } catch {
        // Fall through to leaving it as a proposed action — the user can confirm it manually.
      }
    }
    savedActions.push(action)
  }

  await conversations.touchConversation(conversation.id)

  return {
    conversationId: conversation.id,
    message: { ...assistantMessage, actions: savedActions },
  }
}
