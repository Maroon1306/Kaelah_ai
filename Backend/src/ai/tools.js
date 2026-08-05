import { pool } from '../db/pool.js'
import * as shopify from '../modules/connectors/shopify/shopify.service.js'
import * as wordpress from '../modules/connectors/wordpress/wordpress.service.js'
import * as drupal from '../modules/connectors/drupal/drupal.service.js'
import * as bigcommerce from '../modules/connectors/bigcommerce/bigcommerce.service.js'
import * as prestashop from '../modules/connectors/prestashop/prestashop.service.js'
import * as wix from '../modules/connectors/wix/wix.service.js'
import * as googleSearchConsole from '../modules/connectors/googlesearchconsole/googlesearchconsole.service.js'
import { analyzeUrl, optimizeForGeo, analyzeGeoUrl, checkAiCrawlerAccess, auditImages, suggestImageAlts, suggestKeywords, generateProductSeo, generateArticle } from '../modules/seo/seo.service.js'
import { generateWeeklyReport, sendWeeklyReport } from '../modules/reports/reports.service.js'
import { runAutonomousAgent } from '../modules/agent/agent.service.js'
import { enforceSeoTitle, enforceSeoDescription } from '../utils/seoLimits.js'
import { BULK_PRODUCT_PROVIDERS, BULK_PRODUCT_LIMIT } from './bulkProductProviders.js'

async function getConnector(companyId, provider) {
  const { rows } = await pool.query(
    "SELECT * FROM connectors WHERE company_id = $1 AND provider = $2 AND status = 'connected'",
    [companyId, provider]
  )
  return rows[0] || null
}

const BULK_ARTICLE_LIMIT = 20

// Each tool has an OpenAI function schema plus `mutating` (true = must be
// confirmed by the user before running, false = safe to execute immediately
// so the model can use the result to answer in the same turn).
export const TOOLS = [
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'bulk_optimize_product_seo',
        description: `Optimise automatiquement le titre SEO et la meta description de TOUS les produits d'une boutique connectée en une seule fois (jusqu'à ${BULK_PRODUCT_LIMIT} produits par exécution, pour rester rapide et maîtrisé). Chaque produit reçoit un titre et une description générés par IA à partir de ses propres données réelles (nom, prix, SEO actuel) — utilise cet outil quand l'utilisateur demande d'optimiser "tous mes produits" ou "toute ma boutique". Fonctionne sur Shopify, WordPress/WooCommerce, BigCommerce, PrestaShop et Wix (Catalog V1 uniquement). Nécessite une confirmation utilisateur avant application — la confirmation déclenche la génération ET l'application en une seule fois pour tous les produits.`,
        parameters: {
          type: 'object',
          properties: {
            provider: { type: 'string', enum: Object.keys(BULK_PRODUCT_PROVIDERS), description: 'Connecteur boutique concerné' },
          },
          required: ['provider'],
        },
      },
    },
    async execute(args, { companyId }) {
      const providerConfig = BULK_PRODUCT_PROVIDERS[args.provider]
      if (!providerConfig) return { error: 'invalid_provider', message: `Connecteur inconnu : "${args.provider}".` }
      const connector = await getConnector(companyId, args.provider)
      if (!connector) return { error: 'not_connected', message: `Le connecteur ${args.provider} n'est pas connecté.` }

      const products = await providerConfig.getProducts(connector, BULK_PRODUCT_LIMIT)
      if (products.length === 0) return { error: 'no_products', message: 'Aucun produit trouvé sur cette boutique.' }

      const results = []
      for (const product of products) {
        try {
          const seo = await generateProductSeo({
            title: product.title,
            price: product.price,
            currentSeoTitle: product.seoTitle,
            currentSeoDescription: product.seoDescription,
          })
          const result = await providerConfig.updateSeo(connector, product, seo)
          if (result?.error) {
            results.push({ product: product.title, status: 'failed', error: result.message })
          } else {
            results.push({ product: product.title, status: 'applied', seoTitle: seo.seoTitle, seoDescription: seo.seoDescription })
          }
        } catch (err) {
          results.push({ product: product.title, status: 'failed', error: err?.response?.data?.message || err.message })
        }
      }

      const applied = results.filter((r) => r.status === 'applied').length
      return {
        provider: args.provider,
        totalProducts: products.length,
        applied,
        failed: results.length - applied,
        results,
      }
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'bulk_generate_articles',
        description: `Génère et publie automatiquement plusieurs articles de blog optimisés SEO en une seule fois sur le site WordPress connecté (jusqu'à ${BULK_ARTICLE_LIMIT} articles par exécution). Utilise cet outil quand l'utilisateur demande "écris N articles" ou "génère du contenu de blog". Chaque article a un vrai corps de texte (400-700 mots), un titre SEO et une meta description. Nécessite une confirmation utilisateur avant application — la confirmation déclenche la génération ET la publication en une seule fois pour tous les articles.`,
        parameters: {
          type: 'object',
          properties: {
            topics: {
              type: 'array',
              items: { type: 'string' },
              description: `Liste des sujets d'article à générer, un par article (max ${BULK_ARTICLE_LIMIT}). Si l'utilisateur demande juste "N articles" sans préciser les sujets, propose toi-même N sujets pertinents pour son activité avant d'appeler cet outil.`,
            },
            businessType: { type: 'string', description: "Type d'activité de l'utilisateur, pour garder le ton et le contenu pertinents" },
          },
          required: ['topics'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wordpress')
      if (!connector) return { error: 'not_connected', message: "Le connecteur WordPress n'est pas connecté." }
      const topics = (args.topics || []).slice(0, BULK_ARTICLE_LIMIT)
      if (topics.length === 0) return { error: 'no_topics', message: 'Aucun sujet fourni.' }

      const results = []
      for (const topic of topics) {
        try {
          const article = await generateArticle({ topic, businessType: args.businessType })
          const created = await wordpress.createPost(connector, article)
          results.push({ topic, status: 'published', title: created.title, link: created.link })
        } catch (err) {
          results.push({ topic, status: 'failed', error: err?.response?.data?.message || err.message })
        }
      }

      const published = results.filter((r) => r.status === 'published').length
      return { totalTopics: topics.length, published, failed: results.length - published, results }
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_connectors_status',
        description: "Renvoie la liste des connecteurs (Shopify, WordPress, Drupal, BigCommerce, PrestaShop, Wix) et s'ils sont connectés pour cette entreprise. WooCommerce n'est pas un connecteur séparé : dès que WordPress est connecté, get_woocommerce_products et get_woocommerce_orders_summary fonctionnent automatiquement si WooCommerce est installé sur ce site — ne jamais dire à l'utilisateur qu'il doit connecter WooCommerce séparément.",
        parameters: { type: 'object', properties: {} },
      },
    },
    async execute(args, { companyId }) {
      const { rows } = await pool.query('SELECT provider, status, connected_at FROM connectors WHERE company_id = $1', [companyId])
      return { connectors: rows }
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_shopify_products',
        description: 'Récupère les produits réels de la boutique Shopify connectée.',
        parameters: {
          type: 'object',
          properties: { limit: { type: 'integer', description: 'Nombre de produits à récupérer (max 20)', default: 10 } },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'shopify')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Shopify n'est pas connecté." }
      const products = await shopify.getProducts(connector, Math.min(args.limit || 10, 20))
      return { products }
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_shopify_orders_summary',
        description: "Récupère un résumé réel des commandes récentes de la boutique Shopify connectée (chiffre d'affaires, nombre de commandes).",
        parameters: { type: 'object', properties: {} },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'shopify')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Shopify n'est pas connecté." }
      return shopify.getOrdersSummary(connector)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_shopify_product_seo',
        description: "Met à jour le titre SEO, la meta description ou le titre d'un produit Shopify réel. Le produit est identifié par son nom exact (productName), jamais par un ID deviné de mémoire — utilise toujours le nom exact tel qu'affiché à l'utilisateur (ex. via get_shopify_products). Contrainte SEO stricte : seoTitle doit faire entre 50 et 60 caractères (jamais plus de 70) ; seoDescription doit faire au maximum 150 caractères. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            productName: { type: 'string', description: 'Nom/titre exact du produit tel que renvoyé par get_shopify_products' },
            title: { type: 'string' },
            seoTitle: { type: 'string', description: 'Titre SEO, 50 à 60 caractères idéalement, 70 maximum' },
            seoDescription: { type: 'string', description: 'Meta description, 150 caractères maximum' },
          },
          required: ['productName'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'shopify')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Shopify n'est pas connecté." }
      const product = await shopify.findProductByTitle(connector, args.productName)
      if (!product) return { error: 'product_not_found', message: `Produit introuvable : "${args.productName}". Récupère la liste des produits à jour avant de réessayer.` }
      const safeArgs = {
        ...args,
        seoTitle: args.seoTitle ? enforceSeoTitle(args.seoTitle) : args.seoTitle,
        seoDescription: args.seoDescription ? enforceSeoDescription(args.seoDescription) : args.seoDescription,
      }
      return shopify.updateProductSEO(connector, { ...safeArgs, productId: product.id })
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_shopify_shop_seo',
        description: "Met à jour le titre SEO et la meta description de la page d'accueil de la boutique Shopify réelle (visibles dans les résultats de recherche). Contrainte SEO stricte : title doit faire entre 50 et 60 caractères (jamais plus de 70) ; description doit faire au maximum 150 caractères. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: "Titre SEO de la page d'accueil, 50 à 60 caractères idéalement, 70 maximum" },
            description: { type: 'string', description: "Meta description de la page d'accueil, 150 caractères maximum" },
          },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'shopify')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Shopify n'est pas connecté." }
      const safeArgs = {
        title: args.title ? enforceSeoTitle(args.title) : args.title,
        description: args.description ? enforceSeoDescription(args.description) : args.description,
      }
      return shopify.updateShopSEO(connector, safeArgs)
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_shopify_collections',
        description: 'Récupère les collections réelles de la boutique Shopify connectée, avec leur titre SEO et meta description actuels.',
        parameters: {
          type: 'object',
          properties: { limit: { type: 'integer', description: 'Nombre de collections à récupérer (max 20)', default: 10 } },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'shopify')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Shopify n'est pas connecté." }
      const collections = await shopify.getCollections(connector, Math.min(args.limit || 10, 20))
      return { collections }
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_shopify_collection_seo',
        description: "Met à jour le titre SEO et la meta description d'une collection Shopify réelle. La collection est identifiée par son nom exact (collectionName), jamais par un ID deviné de mémoire — utilise toujours le nom exact tel qu'affiché à l'utilisateur (ex. via get_shopify_collections). Contrainte SEO stricte : seoTitle doit faire entre 50 et 60 caractères (jamais plus de 70) ; seoDescription doit faire au maximum 150 caractères. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            collectionName: { type: 'string', description: 'Nom exact de la collection tel que renvoyé par get_shopify_collections' },
            seoTitle: { type: 'string', description: 'Titre SEO, 50 à 60 caractères idéalement, 70 maximum' },
            seoDescription: { type: 'string', description: 'Meta description, 150 caractères maximum' },
          },
          required: ['collectionName'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'shopify')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Shopify n'est pas connecté." }
      const collection = await shopify.findCollectionByTitle(connector, args.collectionName)
      if (!collection) return { error: 'collection_not_found', message: `Collection introuvable : "${args.collectionName}". Récupère la liste à jour avant de réessayer.` }
      const safeArgs = {
        seoTitle: args.seoTitle ? enforceSeoTitle(args.seoTitle) : args.seoTitle,
        seoDescription: args.seoDescription ? enforceSeoDescription(args.seoDescription) : args.seoDescription,
      }
      return shopify.updateCollectionSEO(connector, { ...safeArgs, collectionId: collection.id, collectionType: collection.type })
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_wordpress_content',
        description: 'Récupère les articles et pages réels du site WordPress connecté, avec leur titre SEO et meta description actuels.',
        parameters: {
          type: 'object',
          properties: { limit: { type: 'integer', description: 'Nombre d\'éléments à récupérer par type (max 20)', default: 10 } },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wordpress')
      if (!connector) return { error: 'not_connected', message: "Le connecteur WordPress n'est pas connecté." }
      const limit = Math.min(args.limit || 10, 20)
      const [posts, pages] = await Promise.all([wordpress.getPosts(connector, limit), wordpress.getPages(connector, limit)])
      return { posts, pages }
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_woocommerce_products',
        description: "Récupère les produits réels de la boutique WooCommerce. Utilise le connecteur WordPress déjà connecté (pas de connecteur WooCommerce séparé) — fonctionne dès que WordPress est connecté et que WooCommerce est installé sur ce site (sinon renvoie une liste vide).",
        parameters: {
          type: 'object',
          properties: { limit: { type: 'integer', description: 'Nombre de produits à récupérer (max 20)', default: 10 } },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wordpress')
      if (!connector) return { error: 'not_connected', message: "Le connecteur WordPress n'est pas connecté." }
      const products = await wordpress.getWooCommerceProducts(connector, Math.min(args.limit || 10, 20))
      return { products }
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_woocommerce_orders_summary',
        description: "Récupère un résumé réel des commandes récentes WooCommerce (chiffre d'affaires, nombre de commandes).",
        parameters: { type: 'object', properties: {} },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wordpress')
      if (!connector) return { error: 'not_connected', message: "Le connecteur WordPress n'est pas connecté." }
      return wordpress.getWooCommerceOrdersSummary(connector)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_wordpress_seo',
        description: "Met à jour le titre SEO et la meta description d'un article, d'une page WordPress, ou d'un produit WooCommerce réel. Le contenu est identifié par son titre exact (contentName), jamais par un ID deviné de mémoire — utilise toujours le titre exact tel qu'affiché à l'utilisateur (ex. via get_wordpress_content ou get_woocommerce_products). Contrainte SEO stricte : seoTitle doit faire entre 50 et 60 caractères (jamais plus de 70) ; seoDescription doit faire au maximum 150 caractères. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            contentName: { type: 'string', description: 'Titre exact de l\'article/page tel que renvoyé par get_wordpress_content' },
            seoTitle: { type: 'string', description: 'Titre SEO, 50 à 60 caractères idéalement, 70 maximum' },
            seoDescription: { type: 'string', description: 'Meta description, 150 caractères maximum' },
          },
          required: ['contentName'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wordpress')
      if (!connector) return { error: 'not_connected', message: "Le connecteur WordPress n'est pas connecté." }
      const content = await wordpress.findContentByTitle(connector, args.contentName)
      if (!content) return { error: 'content_not_found', message: `Contenu introuvable : "${args.contentName}". Récupère la liste à jour avant de réessayer.` }
      const safeArgs = {
        postId: content.id,
        seoTitle: args.seoTitle ? enforceSeoTitle(args.seoTitle) : args.seoTitle,
        seoDescription: args.seoDescription ? enforceSeoDescription(args.seoDescription) : args.seoDescription,
      }
      return wordpress.updateSeoMeta(connector, safeArgs)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_wordpress_homepage_seo',
        description: "Met à jour le titre SEO et la meta description de la page d'accueil du site WordPress connecté (utilise cet outil, jamais update_wordpress_seo, quand l'utilisateur parle de la page d'accueil / accueil du site). Contrainte SEO stricte : seoTitle doit faire entre 50 et 60 caractères (jamais plus de 70) ; seoDescription doit faire au maximum 150 caractères. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            seoTitle: { type: 'string', description: "Titre SEO de la page d'accueil, 50 à 60 caractères idéalement, 70 maximum" },
            seoDescription: { type: 'string', description: "Meta description de la page d'accueil, 150 caractères maximum" },
          },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wordpress')
      if (!connector) return { error: 'not_connected', message: "Le connecteur WordPress n'est pas connecté." }
      const safeArgs = {
        seoTitle: args.seoTitle ? enforceSeoTitle(args.seoTitle) : args.seoTitle,
        seoDescription: args.seoDescription ? enforceSeoDescription(args.seoDescription) : args.seoDescription,
      }
      return wordpress.updateHomepageSeo(connector, safeArgs)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_wordpress_geo',
        description: "Applique une optimisation GEO (Generative Engine Optimization — pour être cité par des IA génératives comme ChatGPT/Perplexity) réelle sur un article ou une page WordPress : résumé conversationnel, paires question/réponse, et données structurées, injectés directement dans la page (script JSON-LD). Le contenu est identifié par son titre exact (contentName). Utilise d'abord analyze_geo_url sur l'URL réelle du contenu pour générer ces éléments avant de proposer cette action. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            contentName: { type: 'string', description: 'Titre exact de l\'article/page tel que renvoyé par get_wordpress_content' },
            conversationalSummary: { type: 'string', description: 'Résumé en 2-3 phrases répondant directement à une question probable' },
            qaPairs: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } }, description: 'Paires question/réponse pertinentes' },
            structuredDataSuggestion: { type: 'string', description: 'Description des données structurées schema.org à inclure' },
          },
          required: ['contentName'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wordpress')
      if (!connector) return { error: 'not_connected', message: "Le connecteur WordPress n'est pas connecté." }
      const content = await wordpress.findContentByTitle(connector, args.contentName)
      if (!content) return { error: 'content_not_found', message: `Contenu introuvable : "${args.contentName}". Récupère la liste à jour avant de réessayer.` }
      return wordpress.updateGeo(connector, { postId: content.id, ...args })
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_wordpress_homepage_geo',
        description: "Applique une optimisation GEO réelle sur la page d'accueil du site WordPress connecté (utilise cet outil, jamais update_wordpress_geo, quand l'utilisateur parle de la page d'accueil / accueil du site) : résumé conversationnel, paires question/réponse, données structurées, injectés directement dans la page (script JSON-LD). Utilise d'abord analyze_geo_url sur l'URL réelle de la page d'accueil pour générer ces éléments avant de proposer cette action. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            conversationalSummary: { type: 'string', description: 'Résumé en 2-3 phrases répondant directement à une question probable' },
            qaPairs: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } }, description: 'Paires question/réponse pertinentes' },
            structuredDataSuggestion: { type: 'string', description: 'Description des données structurées schema.org à inclure' },
          },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wordpress')
      if (!connector) return { error: 'not_connected', message: "Le connecteur WordPress n'est pas connecté." }
      return wordpress.updateHomepageGeo(connector, args)
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_drupal_content',
        description: 'Récupère les contenus réels (articles, pages) du site Drupal connecté, avec leur titre SEO et meta description actuels.',
        parameters: {
          type: 'object',
          properties: { limit: { type: 'integer', description: 'Nombre d\'éléments à récupérer (max 20)', default: 10 } },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'drupal')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Drupal n'est pas connecté." }
      const content = await drupal.getContent(connector, Math.min(args.limit || 10, 20))
      return { content }
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_drupal_seo',
        description: "Met à jour le titre SEO et la meta description d'un contenu Drupal réel. Le contenu est identifié par son titre exact (contentName), jamais par un ID deviné de mémoire — utilise toujours le titre exact tel qu'affiché à l'utilisateur (ex. via get_drupal_content). Contrainte SEO stricte : seoTitle doit faire entre 50 et 60 caractères (jamais plus de 70) ; seoDescription doit faire au maximum 150 caractères. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            contentName: { type: 'string', description: 'Titre exact du contenu tel que renvoyé par get_drupal_content' },
            seoTitle: { type: 'string', description: 'Titre SEO, 50 à 60 caractères idéalement, 70 maximum' },
            seoDescription: { type: 'string', description: 'Meta description, 150 caractères maximum' },
          },
          required: ['contentName'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'drupal')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Drupal n'est pas connecté." }
      const content = await drupal.findContentByTitle(connector, args.contentName)
      if (!content) return { error: 'content_not_found', message: `Contenu introuvable : "${args.contentName}". Récupère la liste à jour avant de réessayer.` }
      const safeArgs = {
        nodeId: content.id,
        seoTitle: args.seoTitle ? enforceSeoTitle(args.seoTitle) : args.seoTitle,
        seoDescription: args.seoDescription ? enforceSeoDescription(args.seoDescription) : args.seoDescription,
      }
      return drupal.updateSeoMeta(connector, safeArgs)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_drupal_homepage_seo',
        description: "Met à jour le titre SEO et la meta description de la page d'accueil du site Drupal connecté (utilise cet outil, jamais update_drupal_seo, quand l'utilisateur parle de la page d'accueil / accueil du site). Contrainte SEO stricte : seoTitle doit faire entre 50 et 60 caractères (jamais plus de 70) ; seoDescription doit faire au maximum 150 caractères. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            seoTitle: { type: 'string', description: "Titre SEO de la page d'accueil, 50 à 60 caractères idéalement, 70 maximum" },
            seoDescription: { type: 'string', description: "Meta description de la page d'accueil, 150 caractères maximum" },
          },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'drupal')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Drupal n'est pas connecté." }
      const safeArgs = {
        seoTitle: args.seoTitle ? enforceSeoTitle(args.seoTitle) : args.seoTitle,
        seoDescription: args.seoDescription ? enforceSeoDescription(args.seoDescription) : args.seoDescription,
      }
      return drupal.updateHomepageSeo(connector, safeArgs)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_drupal_geo',
        description: "Applique une optimisation GEO (Generative Engine Optimization — pour être cité par des IA génératives comme ChatGPT/Perplexity) réelle sur un contenu Drupal : résumé conversationnel, paires question/réponse, et données structurées, injectés directement dans la page (script JSON-LD). Le contenu est identifié par son titre exact (contentName). Utilise d'abord analyze_geo_url sur l'URL réelle du contenu pour générer ces éléments avant de proposer cette action. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            contentName: { type: 'string', description: 'Titre exact du contenu tel que renvoyé par get_drupal_content' },
            conversationalSummary: { type: 'string', description: 'Résumé en 2-3 phrases répondant directement à une question probable' },
            qaPairs: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } }, description: 'Paires question/réponse pertinentes' },
            structuredDataSuggestion: { type: 'string', description: 'Description des données structurées schema.org à inclure' },
          },
          required: ['contentName'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'drupal')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Drupal n'est pas connecté." }
      const content = await drupal.findContentByTitle(connector, args.contentName)
      if (!content) return { error: 'content_not_found', message: `Contenu introuvable : "${args.contentName}". Récupère la liste à jour avant de réessayer.` }
      return drupal.updateGeo(connector, { nodeId: content.id, ...args })
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_drupal_homepage_geo',
        description: "Applique une optimisation GEO réelle sur la page d'accueil du site Drupal connecté (utilise cet outil, jamais update_drupal_geo, quand l'utilisateur parle de la page d'accueil / accueil du site) : résumé conversationnel, paires question/réponse, données structurées, injectés directement dans la page (script JSON-LD). Utilise d'abord analyze_geo_url sur l'URL réelle de la page d'accueil pour générer ces éléments avant de proposer cette action. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            conversationalSummary: { type: 'string', description: 'Résumé en 2-3 phrases répondant directement à une question probable' },
            qaPairs: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } }, description: 'Paires question/réponse pertinentes' },
            structuredDataSuggestion: { type: 'string', description: 'Description des données structurées schema.org à inclure' },
          },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'drupal')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Drupal n'est pas connecté." }
      return drupal.updateHomepageGeo(connector, args)
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_bigcommerce_products',
        description: 'Récupère les produits réels de la boutique BigCommerce connectée.',
        parameters: {
          type: 'object',
          properties: { limit: { type: 'integer', description: 'Nombre de produits à récupérer (max 20)', default: 10 } },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'bigcommerce')
      if (!connector) return { error: 'not_connected', message: "Le connecteur BigCommerce n'est pas connecté." }
      const products = await bigcommerce.getProducts(connector, Math.min(args.limit || 10, 20))
      return { products }
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_bigcommerce_orders_summary',
        description: "Récupère un résumé réel des commandes récentes de la boutique BigCommerce connectée (chiffre d'affaires, nombre de commandes).",
        parameters: { type: 'object', properties: {} },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'bigcommerce')
      if (!connector) return { error: 'not_connected', message: "Le connecteur BigCommerce n'est pas connecté." }
      return bigcommerce.getOrdersSummary(connector)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_bigcommerce_product_seo',
        description: "Met à jour le titre SEO et la meta description d'un produit BigCommerce réel. Le produit est identifié par son nom exact (productName), jamais par un ID deviné de mémoire — utilise toujours le nom exact tel qu'affiché à l'utilisateur (ex. via get_bigcommerce_products). Contrainte SEO stricte : seoTitle doit faire entre 50 et 60 caractères (jamais plus de 70) ; seoDescription doit faire au maximum 150 caractères. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            productName: { type: 'string', description: 'Nom exact du produit tel que renvoyé par get_bigcommerce_products' },
            seoTitle: { type: 'string', description: 'Titre SEO, 50 à 60 caractères idéalement, 70 maximum' },
            seoDescription: { type: 'string', description: 'Meta description, 150 caractères maximum' },
          },
          required: ['productName'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'bigcommerce')
      if (!connector) return { error: 'not_connected', message: "Le connecteur BigCommerce n'est pas connecté." }
      const product = await bigcommerce.findProductByTitle(connector, args.productName)
      if (!product) return { error: 'product_not_found', message: `Produit introuvable : "${args.productName}". Récupère la liste des produits à jour avant de réessayer.` }
      const safeArgs = {
        seoTitle: args.seoTitle ? enforceSeoTitle(args.seoTitle) : args.seoTitle,
        seoDescription: args.seoDescription ? enforceSeoDescription(args.seoDescription) : args.seoDescription,
      }
      return bigcommerce.updateProductSEO(connector, { ...safeArgs, productId: product.id })
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_bigcommerce_shop_seo',
        description: "Met à jour le titre SEO et la meta description de la page d'accueil de la boutique BigCommerce réelle. Contrainte SEO stricte : title doit faire entre 50 et 60 caractères (jamais plus de 70) ; description doit faire au maximum 150 caractères. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: "Titre SEO de la page d'accueil, 50 à 60 caractères idéalement, 70 maximum" },
            description: { type: 'string', description: "Meta description de la page d'accueil, 150 caractères maximum" },
          },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'bigcommerce')
      if (!connector) return { error: 'not_connected', message: "Le connecteur BigCommerce n'est pas connecté." }
      const safeArgs = {
        title: args.title ? enforceSeoTitle(args.title) : args.title,
        description: args.description ? enforceSeoDescription(args.description) : args.description,
      }
      return bigcommerce.updateShopSEO(connector, safeArgs)
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_prestashop_products',
        description: 'Récupère les produits réels de la boutique PrestaShop connectée, avec leur titre SEO et meta description actuels.',
        parameters: {
          type: 'object',
          properties: { limit: { type: 'integer', description: 'Nombre de produits à récupérer (max 20)', default: 10 } },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'prestashop')
      if (!connector) return { error: 'not_connected', message: "Le connecteur PrestaShop n'est pas connecté." }
      const products = await prestashop.getProducts(connector, Math.min(args.limit || 10, 20))
      return { products }
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_prestashop_orders_summary',
        description: "Récupère un résumé réel des commandes récentes de la boutique PrestaShop connectée (chiffre d'affaires, nombre de commandes).",
        parameters: { type: 'object', properties: {} },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'prestashop')
      if (!connector) return { error: 'not_connected', message: "Le connecteur PrestaShop n'est pas connecté." }
      return prestashop.getOrdersSummary(connector)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_prestashop_product_seo',
        description: "Met à jour le titre SEO et la meta description d'un produit PrestaShop réel. Le produit est identifié par son nom exact (productName), jamais par un ID deviné de mémoire — utilise toujours le nom exact tel qu'affiché à l'utilisateur (ex. via get_prestashop_products). Contrainte SEO stricte : seoTitle doit faire entre 50 et 60 caractères (jamais plus de 70) ; seoDescription doit faire au maximum 150 caractères. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            productName: { type: 'string', description: 'Nom exact du produit tel que renvoyé par get_prestashop_products' },
            seoTitle: { type: 'string', description: 'Titre SEO, 50 à 60 caractères idéalement, 70 maximum' },
            seoDescription: { type: 'string', description: 'Meta description, 150 caractères maximum' },
          },
          required: ['productName'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'prestashop')
      if (!connector) return { error: 'not_connected', message: "Le connecteur PrestaShop n'est pas connecté." }
      const product = await prestashop.findProductByTitle(connector, args.productName)
      if (!product) return { error: 'product_not_found', message: `Produit introuvable : "${args.productName}". Récupère la liste des produits à jour avant de réessayer.` }
      const safeArgs = {
        seoTitle: args.seoTitle ? enforceSeoTitle(args.seoTitle) : args.seoTitle,
        seoDescription: args.seoDescription ? enforceSeoDescription(args.seoDescription) : args.seoDescription,
      }
      return prestashop.updateProductSEO(connector, { ...safeArgs, productId: product.id })
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_prestashop_homepage_seo',
        description: "Met à jour le titre SEO et la meta description de la page d'accueil de la boutique PrestaShop connectée. Contrainte SEO stricte : seoTitle doit faire entre 50 et 60 caractères (jamais plus de 70) ; seoDescription doit faire au maximum 150 caractères. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            seoTitle: { type: 'string', description: "Titre SEO de la page d'accueil, 50 à 60 caractères idéalement, 70 maximum" },
            seoDescription: { type: 'string', description: "Meta description de la page d'accueil, 150 caractères maximum" },
          },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'prestashop')
      if (!connector) return { error: 'not_connected', message: "Le connecteur PrestaShop n'est pas connecté." }
      const safeArgs = {
        seoTitle: args.seoTitle ? enforceSeoTitle(args.seoTitle) : args.seoTitle,
        seoDescription: args.seoDescription ? enforceSeoDescription(args.seoDescription) : args.seoDescription,
      }
      return prestashop.updateHomepageSeo(connector, safeArgs)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_prestashop_product_geo',
        description: "Applique une optimisation GEO (Generative Engine Optimization — pour être cité par des IA génératives comme ChatGPT/Perplexity) réelle sur un produit PrestaShop : résumé conversationnel, paires question/réponse, et données structurées, injectés directement dans la page produit (script JSON-LD). Le produit est identifié par son nom exact (productName). Utilise d'abord analyze_geo_url sur l'URL réelle du produit pour générer ces éléments avant de proposer cette action. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            productName: { type: 'string', description: 'Nom exact du produit tel que renvoyé par get_prestashop_products' },
            conversationalSummary: { type: 'string', description: 'Résumé en 2-3 phrases répondant directement à une question probable' },
            qaPairs: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } }, description: 'Paires question/réponse pertinentes' },
            structuredDataSuggestion: { type: 'string', description: 'Description des données structurées schema.org à inclure' },
          },
          required: ['productName'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'prestashop')
      if (!connector) return { error: 'not_connected', message: "Le connecteur PrestaShop n'est pas connecté." }
      const product = await prestashop.findProductByTitle(connector, args.productName)
      if (!product) return { error: 'product_not_found', message: `Produit introuvable : "${args.productName}". Récupère la liste des produits à jour avant de réessayer.` }
      return prestashop.updateProductGeo(connector, { productId: product.id, ...args })
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_prestashop_homepage_geo',
        description: "Applique une optimisation GEO réelle sur la page d'accueil de la boutique PrestaShop connectée : résumé conversationnel, paires question/réponse, données structurées, injectés directement dans la page (script JSON-LD). Utilise d'abord analyze_geo_url sur l'URL réelle de la page d'accueil pour générer ces éléments avant de proposer cette action. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            conversationalSummary: { type: 'string', description: 'Résumé en 2-3 phrases répondant directement à une question probable' },
            qaPairs: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } }, description: 'Paires question/réponse pertinentes' },
            structuredDataSuggestion: { type: 'string', description: 'Description des données structurées schema.org à inclure' },
          },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'prestashop')
      if (!connector) return { error: 'not_connected', message: "Le connecteur PrestaShop n'est pas connecté." }
      return prestashop.updateHomepageGeo(connector, args)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_prestashop_llms_txt',
        description: "Publie ou met à jour le fichier llms.txt de la boutique PrestaShop connectée (résumé structuré en markdown du site, pensé pour être lu par des IA génératives — le pendant GEO de robots.txt). Compose ce contenu toi-même à partir du contenu réel du site (utilise get_prestashop_products d'abord). Format attendu : un titre H1 avec le nom de la boutique, un court résumé, puis des sections avec liens vers les produits clés. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: { content: { type: 'string', description: 'Contenu markdown complet du fichier llms.txt' } },
          required: ['content'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'prestashop')
      if (!connector) return { error: 'not_connected', message: "Le connecteur PrestaShop n'est pas connecté." }
      return prestashop.updateLlmsTxt(connector, args)
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_wix_products',
        description: 'Récupère les produits réels de la boutique Wix Stores connectée.',
        parameters: {
          type: 'object',
          properties: { limit: { type: 'integer', description: 'Nombre de produits à récupérer (max 20)', default: 10 } },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wix')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Wix n'est pas connecté." }
      const products = await wix.getProducts(connector, Math.min(args.limit || 10, 20))
      return { products }
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_wix_orders_summary',
        description: "Récupère un résumé réel des commandes récentes de la boutique Wix Stores connectée (chiffre d'affaires, nombre de commandes).",
        parameters: { type: 'object', properties: {} },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wix')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Wix n'est pas connecté." }
      return wix.getOrdersSummary(connector)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_wix_product_seo',
        description: "Met à jour le titre SEO et la meta description d'un produit Wix Stores réel. Le produit est identifié par son nom exact (productName), jamais par un ID deviné de mémoire — utilise toujours le nom exact tel qu'affiché à l'utilisateur (ex. via get_wix_products). Contrainte SEO stricte : seoTitle doit faire entre 50 et 60 caractères (jamais plus de 70) ; seoDescription doit faire au maximum 150 caractères. Ne fonctionne que sur les boutiques utilisant l'ancienne version de Wix Stores (Catalog V1) — sur la nouvelle version (Catalog V3), Wix ne permet pas encore de modifier le SEO produit par API, l'outil renverra une erreur claire dans ce cas ; explique-le à l'utilisateur sans le présenter comme un bug. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            productName: { type: 'string', description: 'Nom exact du produit tel que renvoyé par get_wix_products' },
            seoTitle: { type: 'string', description: 'Titre SEO, 50 à 60 caractères idéalement, 70 maximum' },
            seoDescription: { type: 'string', description: 'Meta description, 150 caractères maximum' },
          },
          required: ['productName'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wix')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Wix n'est pas connecté." }
      const product = await wix.findProductByTitle(connector, args.productName)
      if (!product) return { error: 'product_not_found', message: `Produit introuvable : "${args.productName}". Récupère la liste des produits à jour avant de réessayer.` }
      const safeArgs = {
        seoTitle: args.seoTitle ? enforceSeoTitle(args.seoTitle) : args.seoTitle,
        seoDescription: args.seoDescription ? enforceSeoDescription(args.seoDescription) : args.seoDescription,
      }
      return wix.updateProductSEO(connector, { ...safeArgs, productId: product.id })
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'analyze_seo_url',
        description: "Analyse une page web publique en profondeur (titre, meta description, canonical, robots noindex, structure H1/H2, Open Graph, Twitter Card, balises ALT, sitemap.xml, liens internes cassés) et retourne un score SEO réel sur 100 avec la liste des problèmes trouvés et des points déjà bons. Utilise ce score pour répondre à des questions du type « fais un audit SEO » ou « quel est mon score SEO ».",
        parameters: {
          type: 'object',
          properties: { url: { type: 'string', description: 'URL complète à analyser' } },
          required: ['url'],
        },
      },
    },
    async execute(args) {
      return analyzeUrl(args.url)
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'analyze_geo_url',
        description: "Analyse une page web publique et génère une optimisation GEO (Generative Engine Optimization) : résumé conversationnel, paires question/réponse, et suggestion de données structurées schema.org — pour aider le contenu à être cité par des IA génératives (ChatGPT, Perplexity, IA de Google). Fonctionne sur n'importe quelle page publique (Shopify, WordPress, Drupal ou autre). Pour appliquer réellement le résultat sur WordPress ou Drupal, utilise ensuite update_wordpress_geo ou update_drupal_geo — l'application automatique n'est pas disponible pour Shopify (limitation de l'API Shopify), donne les recommandations à l'utilisateur pour qu'il les applique lui-même dans son thème.",
        parameters: {
          type: 'object',
          properties: { url: { type: 'string', description: 'URL complète à analyser' } },
          required: ['url'],
        },
      },
    },
    async execute(args) {
      const result = await optimizeForGeo(args.url)
      return result.suggestion
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'suggest_keywords',
        description: "Propose des mots-clés (principaux et longue traîne), des intentions de recherche et des idées d'articles pour un sujet ou un produit donné, à partir de la connaissance du langage du modèle — ce ne sont pas des données de volume de recherche mesurées (aucune plateforme connectée n'expose ce genre de donnée), à présenter comme des pistes à valider plutôt que des statistiques.",
        parameters: {
          type: 'object',
          properties: {
            topic: { type: 'string', description: 'Sujet, produit ou activité pour lequel chercher des mots-clés' },
            businessType: { type: 'string', description: "Type d'activité (ex: e-commerce déco, agence, SaaS)" },
            language: { type: 'string', description: 'Langue cible, français par défaut' },
          },
          required: ['topic'],
        },
      },
    },
    async execute(args) {
      return suggestKeywords(args)
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'audit_images_url',
        description: "Analyse toutes les images d'une page web publique (jusqu'à 25) : balise ALT manquante, poids réel du fichier, format moderne (WebP/AVIF) ou non, dimensions définies, chargement différé (lazy). Utilise cet outil pour répondre à « audite mes images » ou « quelles images sont à optimiser ».",
        parameters: {
          type: 'object',
          properties: { url: { type: 'string', description: 'URL complète de la page à analyser' } },
          required: ['url'],
        },
      },
    },
    async execute(args) {
      return auditImages(args.url)
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'suggest_image_alt_texts',
        description: "Génère des suggestions de texte alternatif (ALT) pour les images d'une page qui n'en ont pas, à partir du contexte réel de la page (titre, H1). Ne modifie rien : à utiliser avant update_wordpress_image_alt pour proposer les textes à l'utilisateur.",
        parameters: {
          type: 'object',
          properties: { url: { type: 'string', description: 'URL complète de la page à analyser' } },
          required: ['url'],
        },
      },
    },
    async execute(args) {
      return suggestImageAlts(args.url)
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'audit_geo_score',
        description: "Calcule un score GEO réel sur 100 pour une page web publique, distinct de analyze_geo_url : vérifie ce qui est déjà en place (données structurées JSON-LD, bloc FAQPage, accès des robots IA, llms.txt publié, quantité de contenu réel exploitable) plutôt que de générer de nouvelles suggestions. Utilise cet outil pour répondre à « quel est mon score GEO » ou « fais un audit GEO » ; utilise analyze_geo_url ensuite pour générer le contenu qui comblera les manques identifiés.",
        parameters: {
          type: 'object',
          properties: { url: { type: 'string', description: 'URL complète à analyser' } },
          required: ['url'],
        },
      },
    },
    async execute(args) {
      return analyzeGeoUrl(args.url)
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'check_ai_crawler_access',
        description: "Vérifie si les robots des IA génératives (GPTBot, ClaudeBot, PerplexityBot, Google-Extended...) peuvent réellement accéder à un site (analyse du vrai robots.txt), et si un fichier llms.txt est publié. Fonctionne sur n'importe quelle plateforme (Shopify, WordPress, Drupal). À utiliser avant toute optimisation GEO pour vérifier que le travail ne sera pas bloqué.",
        parameters: {
          type: 'object',
          properties: { url: { type: 'string', description: "URL racine du site (ex: https://monsite.com)" } },
          required: ['url'],
        },
      },
    },
    async execute(args) {
      return checkAiCrawlerAccess(args.url)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_wordpress_llms_txt',
        description: "Publie ou met à jour le fichier llms.txt du site WordPress connecté (résumé structuré en markdown du site, pensé pour être lu par des IA génératives — le pendant GEO de robots.txt). Compose ce contenu toi-même à partir du contenu réel du site (utilise get_wordpress_content d'abord). Format attendu : un titre H1 avec le nom du site, un court résumé, puis des sections avec liens vers les pages/articles clés. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: { content: { type: 'string', description: 'Contenu markdown complet du fichier llms.txt' } },
          required: ['content'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wordpress')
      if (!connector) return { error: 'not_connected', message: "Le connecteur WordPress n'est pas connecté." }
      return wordpress.updateLlmsTxt(connector, args)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_wordpress_image_alt',
        description: "Met à jour le texte alternatif (ALT) d'une image réelle de la médiathèque WordPress. L'image est identifiée par son URL exacte (imageUrl), telle que renvoyée par audit_images_url ou suggest_image_alt_texts — jamais devinée. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            imageUrl: { type: 'string', description: "URL exacte de l'image, telle que renvoyée par audit_images_url" },
            alt: { type: 'string', description: 'Texte alternatif à appliquer, court et descriptif (max 125 caractères)' },
          },
          required: ['imageUrl', 'alt'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wordpress')
      if (!connector) return { error: 'not_connected', message: "Le connecteur WordPress n'est pas connecté." }
      const media = await wordpress.findMediaByUrl(connector, args.imageUrl)
      if (!media) return { error: 'media_not_found', message: `Image introuvable dans la médiathèque : "${args.imageUrl}". Vérifie qu'elle provient bien de ce site WordPress.` }
      return wordpress.updateImageAlt(connector, { mediaId: media.id, alt: args.alt })
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_wordpress_categories',
        description: "Récupère les catégories de produits (WooCommerce) ou d'articles réelles du site WordPress connecté, avec leur titre SEO et meta description actuels.",
        parameters: {
          type: 'object',
          properties: { limit: { type: 'integer', description: 'Nombre de catégories à récupérer (max 20)', default: 10 } },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wordpress')
      if (!connector) return { error: 'not_connected', message: "Le connecteur WordPress n'est pas connecté." }
      const categories = await wordpress.getCategories(connector, Math.min(args.limit || 10, 20))
      return { categories }
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_wordpress_category_seo',
        description: "Met à jour le titre SEO et la meta description d'une catégorie WordPress/WooCommerce réelle. La catégorie est identifiée par son nom exact (categoryName), jamais par un ID deviné de mémoire — utilise toujours le nom exact tel qu'affiché à l'utilisateur (ex. via get_wordpress_categories). Contrainte SEO stricte : seoTitle doit faire entre 50 et 60 caractères (jamais plus de 70) ; seoDescription doit faire au maximum 150 caractères. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: {
            categoryName: { type: 'string', description: 'Nom exact de la catégorie tel que renvoyé par get_wordpress_categories' },
            seoTitle: { type: 'string', description: 'Titre SEO, 50 à 60 caractères idéalement, 70 maximum' },
            seoDescription: { type: 'string', description: 'Meta description, 150 caractères maximum' },
          },
          required: ['categoryName'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'wordpress')
      if (!connector) return { error: 'not_connected', message: "Le connecteur WordPress n'est pas connecté." }
      const category = await wordpress.findCategoryByTitle(connector, args.categoryName)
      if (!category) return { error: 'category_not_found', message: `Catégorie introuvable : "${args.categoryName}". Récupère la liste à jour avant de réessayer.` }
      const safeArgs = {
        seoTitle: args.seoTitle ? enforceSeoTitle(args.seoTitle) : args.seoTitle,
        seoDescription: args.seoDescription ? enforceSeoDescription(args.seoDescription) : args.seoDescription,
      }
      return wordpress.updateCategorySEO(connector, { ...safeArgs, categoryId: category.id })
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'update_drupal_llms_txt',
        description: "Publie ou met à jour le fichier llms.txt du site Drupal connecté (résumé structuré en markdown du site, pensé pour être lu par des IA génératives — le pendant GEO de robots.txt). Compose ce contenu toi-même à partir du contenu réel du site (utilise get_drupal_content d'abord). Format attendu : un titre H1 avec le nom du site, un court résumé, puis des sections avec liens vers les contenus clés. Nécessite une confirmation utilisateur avant application.",
        parameters: {
          type: 'object',
          properties: { content: { type: 'string', description: 'Contenu markdown complet du fichier llms.txt' } },
          required: ['content'],
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'drupal')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Drupal n'est pas connecté." }
      return drupal.updateLlmsTxt(connector, args)
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_search_console_positions',
        description: "Récupère les vraies positions Google (classement moyen, clics, impressions, CTR) des requêtes qui amènent du trafic sur le site, via Google Search Console — données réelles mesurées, pas une estimation. Nécessite que le connecteur Google Search Console soit connecté et que le site soit une propriété vérifiée sur ce compte Google.",
        parameters: {
          type: 'object',
          properties: {
            siteUrl: { type: 'string', description: "URL de la propriété Search Console à interroger (optionnel si une seule propriété est vérifiée)" },
            days: { type: 'integer', description: 'Nombre de jours à analyser (défaut 28)', default: 28 },
          },
        },
      },
    },
    async execute(args, { companyId }) {
      const connector = await getConnector(companyId, 'google_search_console')
      if (!connector) return { error: 'not_connected', message: "Le connecteur Google Search Console n'est pas connecté." }
      return googleSearchConsole.getSearchPositions(connector, args)
    },
  },
  {
    mutating: false,
    schema: {
      type: 'function',
      function: {
        name: 'get_weekly_report_preview',
        description: "Génère un aperçu du rapport hebdomadaire (scores SEO/GEO des sites connectés, actions appliquées les 7 derniers jours) sans l'envoyer par email. Utilise cet outil quand l'utilisateur demande un résumé de son activité ou un rapport.",
        parameters: { type: 'object', properties: {} },
      },
    },
    async execute(args, { companyId }) {
      return generateWeeklyReport(companyId)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'send_weekly_report_email',
        description: "Envoie immédiatement le rapport hebdomadaire par email à l'adresse du compte. Nécessite une confirmation utilisateur avant application.",
        parameters: { type: 'object', properties: {} },
      },
    },
    async execute(args, { companyId }) {
      return sendWeeklyReport(companyId)
    },
  },
  {
    mutating: true,
    schema: {
      type: 'function',
      function: {
        name: 'run_autonomous_agent_now',
        description: "Lance immédiatement une exécution complète de l'agent autonome : ajoute un titre SEO et une meta description aux produits qui n'en ont aucun (sans jamais écraser ce qui existe déjà) sur toutes les boutiques connectées, puis envoie le rapport hebdomadaire par email. C'est la même action que celle prévue pour tourner automatiquement chaque semaine une fois la planification en place. Nécessite une confirmation utilisateur avant application.",
        parameters: { type: 'object', properties: {} },
      },
    },
    async execute(args, { companyId }) {
      return runAutonomousAgent(companyId)
    },
  },
]

export const TOOL_SCHEMAS = TOOLS.map((t) => t.schema)

export function findTool(name) {
  return TOOLS.find((t) => t.schema.function.name === name)
}
