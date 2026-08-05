// Static frontend content only — marketing copy, UI option lists, and public
// pricing catalog metadata. This is NOT app/business data: conversations,
// connectors, billing/usage, and team members all come from the real backend
// (see src/services/api.js) and are fetched at runtime, never hardcoded here.
// Display text for the items below lives in src/i18n/locales/*.json under the
// `mock` namespace, keyed by each item's id.

export const suggestedPrompts = [
  { id: 'shopAnalysis', icon: 'ShoppingBag' },
  { id: 'seoAudit', icon: 'Search' },
  { id: 'clientMessages', icon: 'MessageSquare' },
  { id: 'salesAnalysis', icon: 'BarChart3' },
]

export const aiCapabilities = [
  { id: 'analytics', icon: 'BarChart3' },
  { id: 'seo', icon: 'Search' },
  { id: 'service', icon: 'MessageSquare' },
  { id: 'automation', icon: 'Zap' },
  { id: 'products', icon: 'Package' },
  { id: 'recommendations', icon: 'Sparkles' },
]

export const platforms = [
  { name: 'Shopify', icon: 'ShoppingBag' },
  { name: 'WordPress', icon: 'FileText' },
  { name: 'Drupal', icon: 'Layers' },
  { name: 'WooCommerce', icon: 'ShoppingCart' },
  { name: 'BigCommerce', icon: 'Store' },
  { name: 'PrestaShop', icon: 'Package' },
  { name: 'Wix Stores', icon: 'Globe' },
]

export const businessTypes = [
  { id: 'ecommerce', icon: 'ShoppingBag' },
  { id: 'agency', icon: 'Building2' },
  { id: 'company', icon: 'Briefcase' },
]

// Public pricing catalog for the (logged-out) Landing page. Real subscription
// state (current plan, usage) is fetched from /api/billing and /api/profile.
export const plans = [
  { id: 'starter', price: '29', period: '/mois' },
  { id: 'pro', price: '79', period: '/mois', popular: true },
  { id: 'business', price: '199', period: '/mois' },
]

export const faqItems = ['shopifySync', 'apiLimits']

export const blogPosts = [
  { id: 'seoTrends2026', slug: 'seo-trends-2026' },
  { id: 'aiCommerce', slug: 'ai-powered-commerce' },
  { id: 'shopifyAutomation', slug: 'shopify-automation-guide' },
]
