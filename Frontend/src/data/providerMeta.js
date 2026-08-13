import { Store, ShoppingBag, FileText, Layers, Package, Globe, Search } from 'lucide-react'

export const PROVIDER_META = {
  shopify: { name: 'Shopify', icon: ShoppingBag, color: '#95BF47' },
  wordpress: { name: 'WordPress/WooCommerce', icon: FileText, color: '#21759B' },
  drupal: { name: 'Drupal', icon: Layers, color: '#0678BE' },
  bigcommerce: { name: 'BigCommerce', icon: Store, color: '#34313F' },
  prestashop: { name: 'PrestaShop', icon: Package, color: '#DF0067' },
  wix: { name: 'Wix Stores', icon: Globe, color: '#0C6EFC' },
  google_search_console: { name: 'Google Search Console', icon: Search, color: '#4285F4' },
}
