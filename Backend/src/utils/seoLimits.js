export const SEO_TITLE_TARGET_MIN = 50
export const SEO_TITLE_TARGET_MAX = 60
export const SEO_TITLE_HARD_MAX = 70
export const SEO_DESCRIPTION_HARD_MAX = 150

const PLATFORM_NAMES = ['WordPress', 'Drupal', 'Shopify', 'WooCommerce']

function truncateAtWordBoundary(text, max) {
  if (!text || text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()
}

function stripPlatformNames(text) {
  if (!text) return text
  let cleaned = text
  for (const name of PLATFORM_NAMES) {
    cleaned = cleaned.replace(new RegExp(`\\s*[-–|•]?\\s*\\b${name}\\b\\s*[-–|•]?\\s*`, 'gi'), ' ')
  }
  return cleaned.replace(/\s{2,}/g, ' ').replace(/\s+([.,!?])/g, '$1').trim()
}

export function enforceSeoTitle(title) {
  return truncateAtWordBoundary(stripPlatformNames(title), SEO_TITLE_HARD_MAX)
}

export function enforceSeoDescription(description) {
  return truncateAtWordBoundary(stripPlatformNames(description), SEO_DESCRIPTION_HARD_MAX)
}
