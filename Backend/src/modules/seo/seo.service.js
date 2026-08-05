import axios from 'axios'
import * as cheerio from 'cheerio'
import { getOpenAIClient, OPENAI_MODEL } from '../../ai/openai.client.js'
import { HttpError } from '../../middleware/errorHandler.js'
import { enforceSeoTitle, enforceSeoDescription } from '../../utils/seoLimits.js'

export async function fetchPage(url) {
  try {
    const { data } = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KaelahAI/1.0; +https://kaelah.ai)' },
      maxContentLength: 5 * 1024 * 1024,
    })
    return data
  } catch (err) {
    throw new HttpError(400, `Impossible de récupérer la page: ${err.message}`)
  }
}

export function extractSeoElements(html, url) {
  const $ = cheerio.load(html)

  const title = $('title').first().text().trim()
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || ''
  const canonical = $('link[rel="canonical"]').attr('href')?.trim() || ''
  const robotsMeta = $('meta[name="robots"]').attr('content')?.trim().toLowerCase() || ''
  const h1s = $('h1').map((_, el) => $(el).text().trim()).get()
  const h2s = $('h2').map((_, el) => $(el).text().trim()).get()
  const h3s = $('h3').map((_, el) => $(el).text().trim()).get()
  const images = $('img')
  const imagesTotal = images.length
  const imagesMissingAlt = images.filter((_, el) => !$(el).attr('alt')?.trim()).length
  const imageList = images
    .map((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || ''
      if (!src) return null
      let absoluteSrc = src
      if (url) { try { absoluteSrc = new URL(src, url).href } catch { /* keep raw src */ } }
      return {
        src: absoluteSrc,
        alt: $(el).attr('alt')?.trim() || '',
        loading: $(el).attr('loading') || '',
        hasDimensions: Boolean($(el).attr('width') && $(el).attr('height')),
      }
    })
    .get()
    .filter(Boolean)

  const og = {
    title: $('meta[property="og:title"]').attr('content')?.trim() || '',
    description: $('meta[property="og:description"]').attr('content')?.trim() || '',
    image: $('meta[property="og:image"]').attr('content')?.trim() || '',
  }
  const twitterCard = $('meta[name="twitter:card"]').attr('content')?.trim() || ''

  const structuredDataBlocks = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).contents().text())
    .get()
    .filter(Boolean)
  let structuredDataTypes = []
  for (const block of structuredDataBlocks) {
    try {
      const parsed = JSON.parse(block)
      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        if (item?.['@type']) structuredDataTypes.push(item['@type'])
      }
    } catch {
      // Malformed JSON-LD block — ignore, doesn't count as valid structured data.
    }
  }

  let internalLinks = []
  if (url) {
    let origin
    try { origin = new URL(url).origin } catch { origin = null }
    internalLinks = $('a[href]')
      .map((_, el) => $(el).attr('href'))
      .get()
      .filter((href) => href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:'))
      .map((href) => {
        try { return new URL(href, url).href } catch { return null }
      })
      .filter((href) => href && (!origin || href.startsWith(origin)))
    internalLinks = [...new Set(internalLinks)].slice(0, 15)
  }

  return {
    title, metaDescription, canonical, robotsMeta, h1s, h2s, h3s,
    imagesTotal, imagesMissingAlt, imageList, og, twitterCard, structuredDataTypes, internalLinks,
  }
}

/**
 * HEAD-checks a capped sample of internal links found on the page. Capped
 * and run in parallel with a short timeout so one slow/broken site can't
 * stall the whole audit.
 */
async function findBrokenLinks(links) {
  const results = await Promise.all(
    links.map(async (link) => {
      try {
        const res = await axios.head(link, { timeout: 6000, validateStatus: () => true, maxRedirects: 5 })
        return res.status >= 400 ? { url: link, status: res.status } : null
      } catch {
        return { url: link, status: null }
      }
    })
  )
  return results.filter(Boolean)
}

async function checkSitemap(url) {
  try {
    const origin = new URL(url).origin
    const res = await axios.get(`${origin}/sitemap.xml`, { timeout: 6000, validateStatus: () => true })
    return res.status === 200
  } catch {
    return false
  }
}

function scoreSeo({ title, metaDescription, canonical, robotsMeta, h1s, h2s, imagesTotal, imagesMissingAlt, og, twitterCard, sitemapFound, brokenLinks }) {
  let score = 0
  const max = 100
  const issues = []
  const passed = []

  // Title — 15
  if (!title) { issues.push('Balise <title> manquante') }
  else if (title.length > 60) { score += 10; issues.push('Titre trop long (> 60 caractères)') }
  else if (title.length < 30) { score += 10; issues.push('Titre trop court (< 30 caractères)') }
  else { score += 15; passed.push('Titre présent et bien dimensionné') }

  // Meta description — 15
  if (!metaDescription) { issues.push('Meta description manquante') }
  else if (metaDescription.length > 160) { score += 10; issues.push('Meta description trop longue (> 160 caractères)') }
  else { score += 15; passed.push('Meta description présente et bien dimensionnée') }

  // H1 — 10
  if (h1s.length === 0) { issues.push('Aucune balise H1 trouvée') }
  else if (h1s.length > 1) { score += 4; issues.push('Plusieurs balises H1 détectées (une seule recommandée)') }
  else { score += 10; passed.push('Une seule balise H1, correcte') }

  // Heading structure — 5
  if (h2s.length > 0) { score += 5; passed.push('Structure de titres (H2+) présente') }
  else { issues.push('Aucune balise H2 — structure du contenu peu claire') }

  // Canonical — 10
  if (canonical) { score += 10; passed.push('Balise canonical présente') }
  else { issues.push('Balise canonical manquante') }

  // Robots meta — 10 (critical: noindex silently removes the page from search)
  if (robotsMeta.includes('noindex')) { issues.push('⚠️ La page est en "noindex" — invisible pour Google') }
  else { score += 10; passed.push("Page indexable (pas de noindex)") }

  // Open Graph — 10
  const ogComplete = og.title && og.description && og.image
  if (ogComplete) { score += 10; passed.push('Open Graph complet (titre, description, image)') }
  else if (og.title || og.description) { score += 4; issues.push('Open Graph incomplet') }
  else { issues.push('Aucune balise Open Graph — mauvais rendu au partage sur les réseaux') }

  // Twitter Card — 5
  if (twitterCard) { score += 5; passed.push('Twitter Card présente') }
  else { issues.push('Twitter Card manquante') }

  // Images ALT — 10
  if (imagesTotal === 0) { score += 10 }
  else {
    const ratio = 1 - imagesMissingAlt / imagesTotal
    score += Math.round(10 * ratio)
    if (imagesMissingAlt > 0) issues.push(`${imagesMissingAlt} image(s) sur ${imagesTotal} sans balise ALT`)
    else passed.push('Toutes les images ont une balise ALT')
  }

  // Sitemap — 5
  if (sitemapFound) { score += 5; passed.push('sitemap.xml accessible') }
  else { issues.push('sitemap.xml introuvable') }

  // Broken links — 5
  if (brokenLinks.length === 0) { score += 5; passed.push('Aucun lien interne cassé détecté (échantillon)') }
  else { issues.push(`${brokenLinks.length} lien(s) interne(s) cassé(s) détecté(s)`) }

  return { score: Math.min(max, score), issues, passed }
}

export async function analyzeUrl(url) {
  const html = await fetchPage(url)
  const elements = extractSeoElements(html, url)
  const [sitemapFound, brokenLinks] = await Promise.all([
    checkSitemap(url),
    findBrokenLinks(elements.internalLinks),
  ])
  const { score, issues, passed } = scoreSeo({ ...elements, sitemapFound, brokenLinks })
  return { url, score, issues, passed, sitemapFound, brokenLinks, ...elements }
}

export async function optimizePage(url) {
  const analysis = await analyzeUrl(url)
  const client = getOpenAIClient()
  if (!client) {
    throw new HttpError(503, "OPENAI_API_KEY n'est pas configurée côté serveur — impossible de générer une optimisation.")
  }

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content: 'Tu es un expert SEO. Tu réponds uniquement en JSON valide, sans texte autour, avec les clés: title, metaDescription, h1, faq (tableau de {question, answer}). Contrainte stricte : title doit faire entre 50 et 60 caractères (jamais plus de 70) ; metaDescription doit faire au maximum 150 caractères.',
      },
      {
        role: 'user',
        content: `Optimise le référencement de cette page en te basant sur son contenu actuel.\nURL: ${url}\nTitre actuel: ${analysis.title}\nMeta description actuelle: ${analysis.metaDescription}\nH1 actuels: ${analysis.h1s.join(', ') || 'aucun'}\nProblèmes détectés: ${analysis.issues.join(', ') || 'aucun'}`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  const suggestion = JSON.parse(completion.choices[0].message.content)
  if (suggestion.title) suggestion.title = enforceSeoTitle(suggestion.title)
  if (suggestion.metaDescription) suggestion.metaDescription = enforceSeoDescription(suggestion.metaDescription)
  return { before: analysis, suggestion }
}

export async function optimizeForGeo(url) {
  const analysis = await analyzeUrl(url)
  const client = getOpenAIClient()
  if (!client) {
    throw new HttpError(503, "OPENAI_API_KEY n'est pas configurée côté serveur — impossible de générer une optimisation.")
  }

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content: 'Tu es un expert en GEO (Generative Engine Optimization) — l\'optimisation pour être cité par des moteurs de recherche IA conversationnels (ChatGPT, Perplexity, IA de Google). Tu réponds uniquement en JSON valide avec les clés: conversationalSummary (résumé de la page en 2-3 phrases répondant directement à une question probable), qaPairs (tableau de {question, answer} couvrant les questions que des utilisateurs poseraient à une IA), structuredDataSuggestion (texte décrivant les données structurées schema.org à ajouter).',
      },
      {
        role: 'user',
        content: `Optimise cette page pour la recherche IA générative (GEO).\nURL: ${url}\nTitre actuel: ${analysis.title}\nMeta description actuelle: ${analysis.metaDescription}\nH1 actuels: ${analysis.h1s.join(', ') || 'aucun'}`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  const suggestion = JSON.parse(completion.choices[0].message.content)
  return { before: analysis, suggestion }
}

const AI_CRAWLERS = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'Google-Extended', 'CCBot', 'Bytespider']

function parseRobotsGroups(text) {
  const groups = []
  let current = null
  for (const rawLine of text.split('\n')) {
    const line = rawLine.split('#')[0].trim()
    if (!line) continue
    const [rawKey, ...rest] = line.split(':')
    const key = rawKey.trim().toLowerCase()
    const value = rest.join(':').trim()
    if (key === 'user-agent') {
      if (!current || current.rules.length > 0) {
        current = { agents: [value], rules: [] }
        groups.push(current)
      } else {
        current.agents.push(value)
      }
    } else if ( ( key === 'disallow' || key === 'allow' ) && current ) {
      current.rules.push({ type: key, path: value })
    }
  }
  return groups
}

function isBlocked(groups, agent) {
  const normalized = agent.toLowerCase()
  const group = groups.find((g) => g.agents.some((a) => a.toLowerCase() === normalized)) || groups.find((g) => g.agents.includes('*'))
  if (!group) return false
  const blockRoot = group.rules.some((r) => r.type === 'disallow' && (r.path === '/' || r.path === ''))
  const allowRoot = group.rules.some((r) => r.type === 'allow' && (r.path === '/' || r.path === ''))
  return blockRoot && !allowRoot
}

/**
 * Checks whether well-known AI/GEO crawlers can actually reach a site, and
 * whether it publishes an llms.txt — the two prerequisites for any GEO
 * optimization to matter at all. Works on any public site (Shopify,
 * WordPress, Drupal, or otherwise) via a plain HTTP fetch, no connector
 * required.
 */
export async function checkAiCrawlerAccess(siteUrl) {
  const base = siteUrl.replace(/\/$/, '')
  let robotsText = ''
  let robotsFound = false
  try {
    const { data } = await axios.get(`${base}/robots.txt`, { timeout: 8000, validateStatus: (s) => s === 200 })
    robotsText = String(data)
    robotsFound = true
  } catch {
    // No robots.txt at all means nothing is blocked by default.
  }

  const groups = robotsFound ? parseRobotsGroups(robotsText) : []
  const crawlers = AI_CRAWLERS.map((name) => ({ name, blocked: robotsFound ? isBlocked(groups, name) : false }))

  let llmsTxtFound = false
  try {
    const res = await axios.get(`${base}/llms.txt`, { timeout: 8000, validateStatus: (s) => s === 200 })
    llmsTxtFound = typeof res.data === 'string' && res.data.trim().length > 0
  } catch {
    // Not published yet.
  }

  return {
    robotsTxtFound: robotsFound,
    llmsTxtFound,
    crawlers,
    anyBlocked: crawlers.some((c) => c.blocked),
  }
}

/**
 * A real, scored GEO diagnostic (distinct from optimizeForGeo, which
 * generates AI suggestions) — checks what's actually verifiable on the
 * page and site right now: structured data present, AI crawlers allowed,
 * llms.txt published, and enough real page content for an AI to summarize
 * accurately in the first place.
 */
export async function analyzeGeoUrl(url) {
  const html = await fetchPage(url)
  const elements = extractSeoElements(html, url)
  const siteUrl = new URL(url).origin
  const crawlerAccess = await checkAiCrawlerAccess(siteUrl)

  let score = 0
  const issues = []
  const passed = []

  // Structured data (schema.org / JSON-LD) — 30
  if (elements.structuredDataTypes.length > 0) {
    score += 30
    passed.push(`Données structurées présentes (${elements.structuredDataTypes.join(', ')})`)
  } else {
    issues.push('Aucune donnée structurée (JSON-LD) détectée sur la page')
  }

  // FAQPage specifically — GEO tools care about this pattern — 15
  if (elements.structuredDataTypes.includes('FAQPage')) {
    score += 15
    passed.push('Bloc FAQPage détecté — utile pour être cité directement par les IA')
  } else {
    issues.push('Pas de bloc FAQPage — les IA génératives ont moins de matière à citer directement')
  }

  // AI crawler access — 25
  if (!crawlerAccess.robotsTxtFound) { score += 15; issues.push('Aucun robots.txt trouvé (rien n\'est bloqué par défaut, mais rien n\'est confirmé non plus)') }
  else if (!crawlerAccess.anyBlocked) { score += 25; passed.push('Tous les robots IA connus sont autorisés') }
  else {
    const blocked = crawlerAccess.crawlers.filter((c) => c.blocked).map((c) => c.name)
    issues.push(`Robots IA bloqués : ${blocked.join(', ')}`)
  }

  // llms.txt — 15
  if (crawlerAccess.llmsTxtFound) { score += 15; passed.push('llms.txt publié') }
  else { issues.push('llms.txt non publié') }

  // Enough real content to summarize — 15
  const textLength = cheerio.load(html)('body').text().trim().length
  if (textLength > 500) { score += 15; passed.push('Contenu textuel suffisant pour un résumé IA pertinent') }
  else { issues.push('Peu de contenu textuel réel sur la page — difficile à résumer correctement pour une IA') }

  return {
    url,
    score: Math.min(100, score),
    issues,
    passed,
    structuredDataTypes: elements.structuredDataTypes,
    ...crawlerAccess,
  }
}

const MODERN_IMAGE_FORMATS = ['image/webp', 'image/avif']
const HEAVY_IMAGE_BYTES = 200 * 1024

/**
 * Audits every image on a page: missing ALT text, file weight, whether it's
 * served in a modern format (WebP/AVIF), explicit dimensions (layout shift
 * risk) and lazy loading. Weight/format come from a real HEAD request per
 * image, capped at 25 so a huge page can't stall the audit.
 */
export async function auditImages(url) {
  const html = await fetchPage(url)
  const { imageList } = extractSeoElements(html, url)
  const sample = imageList.slice(0, 25)

  const checked = await Promise.all(
    sample.map(async (img, index) => {
      let bytes = null
      let contentType = null
      try {
        const res = await axios.head(img.src, { timeout: 6000, validateStatus: () => true })
        const len = res.headers['content-length']
        bytes = len ? Number(len) : null
        contentType = res.headers['content-type'] || null
      } catch {
        // Unreachable image — still report the other findings below.
      }

      const issues = []
      if (!img.alt) issues.push('Balise ALT manquante')
      if (bytes && bytes > HEAVY_IMAGE_BYTES) issues.push(`Image lourde (${Math.round(bytes / 1024)} Ko)`)
      if (contentType && !MODERN_IMAGE_FORMATS.includes(contentType)) issues.push(`Format non moderne (${contentType.replace('image/', '')}, WebP/AVIF recommandé)`)
      if (!img.hasDimensions) issues.push('Largeur/hauteur non définies (risque de décalage visuel au chargement)')
      if (index > 2 && img.loading !== 'lazy') issues.push('Chargement différé (lazy) non activé')

      return { ...img, bytes, contentType, issues }
    })
  )

  const totalIssues = checked.reduce((sum, img) => sum + img.issues.length, 0)
  const withAlt = checked.filter((img) => img.alt).length

  return {
    url,
    imagesFound: imageList.length,
    imagesChecked: checked.length,
    imagesWithAlt: withAlt,
    imagesMissingAlt: checked.length - withAlt,
    images: checked,
    summary: totalIssues === 0
      ? 'Aucun problème détecté sur les images analysées.'
      : `${totalIssues} problème(s) détecté(s) sur ${checked.length} image(s) analysée(s).`,
  }
}

/**
 * Generates real ALT text suggestions for images missing one, using the
 * page's own title/H1 as context so the wording stays on-topic rather than
 * generic. Read-only — actually writing the ALT text back happens per
 * platform (see update_wordpress_image_alt).
 */
export async function suggestImageAlts(url) {
  const audit = await auditImages(url)
  const missing = audit.images.filter((img) => !img.alt)
  if (missing.length === 0) return { url, suggestions: [] }

  const client = getOpenAIClient()
  if (!client) throw new HttpError(503, "OPENAI_API_KEY n'est pas configurée côté serveur — impossible de générer des suggestions.")

  const html = await fetchPage(url)
  const { title, h1s } = extractSeoElements(html, url)

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content: "Tu es un expert en accessibilité et SEO d'images. Tu réponds uniquement en JSON valide avec la clé \"suggestions\" : un tableau d'objets {src, alt}, un par image fournie, dans le même ordre. Le texte alt doit être court (max 125 caractères), descriptif, sans \"image de\" ni \"photo de\", et cohérent avec le contexte de la page.",
      },
      {
        role: 'user',
        content: `Page: ${title || h1s[0] || url}\nImages à décrire (URLs, pour contexte de nommage de fichier uniquement) :\n${missing.map((img) => img.src).join('\n')}`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  const { suggestions } = JSON.parse(completion.choices[0].message.content)
  return { url, suggestions: suggestions || [] }
}

/**
 * AI-generated keyword research: no external keyword-volume API is wired up
 * (none of the connected platforms expose one), so this leans on the
 * model's own knowledge of search intent and phrasing patterns rather than
 * real search-volume data — presented to the user as ideas to validate, not
 * as measured metrics.
 */
export async function suggestKeywords({ topic, businessType, language }) {
  const client = getOpenAIClient()
  if (!client) throw new HttpError(503, "OPENAI_API_KEY n'est pas configurée côté serveur — impossible de générer des suggestions.")

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content: 'Tu es un expert en recherche de mots-clés SEO/GEO. Tu réponds uniquement en JSON valide avec les clés : primaryKeywords (5-8 mots-clés principaux courts et à forte intention d\'achat), longTailKeywords (8-12 expressions longue traîne réalistes, 3 à 6 mots), searchIntents (tableau de {keyword, intent} où intent est "informationnel", "transactionnel" ou "navigationnel"), articleIdeas (5 titres d\'articles de blog concrets ciblant ces mots-clés). Précise que ce sont des suggestions basées sur ta connaissance du langage et de l\'intention de recherche, pas des données de volume de recherche mesurées.',
      },
      {
        role: 'user',
        content: `Sujet / produit : ${topic}\nType d'activité : ${businessType || 'non précisé'}\nLangue : ${language || 'français'}`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  return JSON.parse(completion.choices[0].message.content)
}

/**
 * Generates an SEO title + meta description directly from a product's own
 * data (name/price/existing copy) rather than fetching its live page — used
 * by bulk-optimize flows where fetching every product's real URL one by one
 * would be slow and where the connector already has the data we need.
 */
export async function generateProductSeo({ title, price, currentSeoTitle, currentSeoDescription }) {
  const client = getOpenAIClient()
  if (!client) throw new HttpError(503, "OPENAI_API_KEY n'est pas configurée côté serveur — impossible de générer une optimisation.")

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content: 'Tu es un expert SEO e-commerce. Tu réponds uniquement en JSON valide avec les clés seoTitle et seoDescription. Contrainte stricte : seoTitle doit faire entre 50 et 60 caractères (jamais plus de 70) ; seoDescription doit faire au maximum 150 caractères. Ne mentionne jamais le nom de la plateforme (Shopify, WooCommerce, etc.) dans le texte.',
      },
      {
        role: 'user',
        content: `Produit : ${title}${price ? `\nPrix : ${price}` : ''}${currentSeoTitle ? `\nTitre SEO actuel : ${currentSeoTitle}` : ''}${currentSeoDescription ? `\nMeta description actuelle : ${currentSeoDescription}` : ''}`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  const suggestion = JSON.parse(completion.choices[0].message.content)
  return {
    seoTitle: suggestion.seoTitle ? enforceSeoTitle(suggestion.seoTitle) : '',
    seoDescription: suggestion.seoDescription ? enforceSeoDescription(suggestion.seoDescription) : '',
  }
}

/**
 * Generates one full, real blog article (title, HTML body, SEO title/meta
 * description) for a given topic — used by bulk article-generation flows.
 * Real body content (several paragraphs with headings), not a stub.
 */
export async function generateArticle({ topic, businessType, language }) {
  const client = getOpenAIClient()
  if (!client) throw new HttpError(503, "OPENAI_API_KEY n'est pas configurée côté serveur — impossible de générer un article.")

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      {
        role: 'system',
        content: 'Tu es un rédacteur SEO. Tu réponds uniquement en JSON valide avec les clés : title (titre de l\'article), content (corps de l\'article en HTML simple avec des balises <p> et <h2>, 400 à 700 mots, informatif et concret, sans placeholder), seoTitle (50-60 caractères, jamais plus de 70), seoDescription (150 caractères maximum). Ne mentionne jamais de nom de plateforme technique (WordPress, WooCommerce, etc.) dans le texte.',
      },
      {
        role: 'user',
        content: `Sujet de l'article : ${topic}\nType d'activité : ${businessType || 'non précisé'}\nLangue : ${language || 'français'}`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  const article = JSON.parse(completion.choices[0].message.content)
  return {
    title: article.title || topic,
    content: article.content || '',
    seoTitle: article.seoTitle ? enforceSeoTitle(article.seoTitle) : '',
    seoDescription: article.seoDescription ? enforceSeoDescription(article.seoDescription) : '',
  }
}
