import { Router } from 'express'
import crypto from 'node:crypto'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { getOpenAIClient, OPENAI_MODEL } from '../../ai/openai.client.js'
import * as shopify from '../connectors/shopify/shopify.service.js'
import * as automationsService from '../automations/automations.service.js'

export const webhooksRouter = Router()

function verifyShopifyHmac(rawBody, hmacHeader) {
  const digest = crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET).update(rawBody).digest('base64')
  return digest === hmacHeader
}

// Mounted with express.raw() in app.js so req.body is the raw Buffer needed for HMAC verification.
webhooksRouter.post('/shopify', asyncHandler(async (req, res) => {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256')
  const shopDomain = req.get('X-Shopify-Shop-Domain')
  const topic = req.get('X-Shopify-Topic')
  const rawBody = req.body // Buffer

  if (!hmacHeader || !verifyShopifyHmac(rawBody, hmacHeader)) {
    return res.status(401).send('Invalid HMAC')
  }

  res.status(200).send('OK') // ack immediately, process async

  if (topic !== 'products/create') return
  const payload = JSON.parse(rawBody.toString('utf8'))

  const connector = await shopify.findConnectorByShop(shopDomain)
  if (!connector) return

  const automation = await automationsService.findActive(connector.company_id, 'shopify_product_created', 'generate_seo')
  if (!automation) return

  try {
    const client = getOpenAIClient()
    if (!client) return
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'Tu es un expert SEO e-commerce. Réponds uniquement en JSON avec les clés seoTitle et seoDescription.' },
        { role: 'user', content: `Génère un titre SEO et une meta description pour ce produit: ${payload.title}\nDescription: ${payload.body_html || ''}` },
      ],
      response_format: { type: 'json_object' },
    })
    const { seoTitle, seoDescription } = JSON.parse(completion.choices[0].message.content)
    await shopify.updateProductSEO(connector, { productId: payload.id, seoTitle, seoDescription })
    console.log(`[automation] Generated SEO for new product ${payload.id} (${shopDomain})`)
  } catch (err) {
    console.error('[automation] Failed to auto-generate SEO for new product:', err.message)
  }
}))
