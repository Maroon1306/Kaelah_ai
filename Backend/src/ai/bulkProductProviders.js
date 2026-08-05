import * as shopify from '../modules/connectors/shopify/shopify.service.js'
import * as wordpress from '../modules/connectors/wordpress/wordpress.service.js'
import * as bigcommerce from '../modules/connectors/bigcommerce/bigcommerce.service.js'
import * as prestashop from '../modules/connectors/prestashop/prestashop.service.js'
import * as wix from '../modules/connectors/wix/wix.service.js'

// Product-connector adapter shared by bulk_optimize_product_seo (tools.js)
// and the autonomous agent (agent.service.js) — each provider's
// getProducts/updateProductSEO already exists per-connector, this just
// normalizes the call shape so both callers can drive all of them the same way.
export const BULK_PRODUCT_PROVIDERS = {
  shopify: {
    getProducts: (connector, limit) => shopify.getProducts(connector, limit),
    updateSeo: (connector, product, seo) => shopify.updateProductSEO(connector, { productId: product.id, ...seo }),
  },
  wordpress: {
    getProducts: (connector, limit) => wordpress.getWooCommerceProducts(connector, limit),
    updateSeo: (connector, product, seo) => wordpress.updateSeoMeta(connector, { postId: product.id, ...seo }),
  },
  bigcommerce: {
    getProducts: (connector, limit) => bigcommerce.getProducts(connector, limit),
    updateSeo: (connector, product, seo) => bigcommerce.updateProductSEO(connector, { productId: product.id, ...seo }),
  },
  prestashop: {
    getProducts: (connector, limit) => prestashop.getProducts(connector, limit),
    updateSeo: (connector, product, seo) => prestashop.updateProductSEO(connector, { productId: product.id, ...seo }),
  },
  wix: {
    getProducts: (connector, limit) => wix.getProducts(connector, limit),
    updateSeo: (connector, product, seo) => wix.updateProductSEO(connector, { productId: product.id, ...seo }),
  },
}

export const BULK_PRODUCT_LIMIT = 25
