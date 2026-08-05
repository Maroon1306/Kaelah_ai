// Maps each AI tool to the connector provider it needs (for filtering which
// tool schemas we even send to OpenAI — the biggest lever on per-message
// cost, since function definitions are resent on every call) and to the
// paid "feature" it requires, if any (for plan gating).

const PROVIDER_SLUGS = ['bigcommerce', 'prestashop', 'wordpress', 'drupal', 'shopify', 'wix', 'google_search_console']

export function getToolProvider(functionName) {
  return PROVIDER_SLUGS.find((slug) => functionName.includes(slug)) || null
}

const FEATURE_GATED_TOOLS = {
  bulk_optimize_product_seo: 'bulk',
  bulk_generate_articles: 'bulk',
  get_search_console_positions: 'google_search_console',
  run_autonomous_agent_now: 'agent',
}

export function getToolFeature(functionName) {
  return FEATURE_GATED_TOOLS[functionName] || null
}
