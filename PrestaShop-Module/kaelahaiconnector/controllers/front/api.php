<?php
/**
 * Thin, generic REST-style gateway used by Kaelah AI to read and update
 * products/orders on this store. No SEO/GEO/AI logic lives here — Kaelah's
 * own servers decide what to fetch and what to write; this controller only
 * exposes authenticated access to PrestaShop's own data.
 *
 * Dispatched by an `action` query parameter rather than path segments,
 * since PrestaShop module front controllers don't reliably support extra
 * path segments across every server/rewrite configuration.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class KaelahaiconnectorApiModuleFrontController extends ModuleFrontController
{
    public $ssl = true;

    public function initContent()
    {
        $auth = $this->checkToken();
        if (true !== $auth) {
            $this->respond($auth, 401);
        }

        $action = Tools::getValue('action');
        $method = $_SERVER['REQUEST_METHOD'];

        try {
            switch ($action) {
                case 'site-info':
                    $this->respond($this->getSiteInfo());
                    break;
                case 'products':
                    $this->respond($this->getProducts());
                    break;
                case 'product-seo':
                    if ('POST' !== $method) {
                        $this->respond(['error' => 'method_not_allowed'], 405);
                    }
                    $this->respond($this->updateProductSeo((int) Tools::getValue('id')));
                    break;
                case 'product-geo':
                    if ('POST' !== $method) {
                        $this->respond(['error' => 'method_not_allowed'], 405);
                    }
                    $this->respond($this->updateProductGeo((int) Tools::getValue('id')));
                    break;
                case 'homepage-seo':
                    if ('POST' !== $method) {
                        $this->respond(['error' => 'method_not_allowed'], 405);
                    }
                    $this->respond($this->updateHomepageSeo());
                    break;
                case 'homepage-geo':
                    if ('POST' !== $method) {
                        $this->respond(['error' => 'method_not_allowed'], 405);
                    }
                    $this->respond($this->updateHomepageGeo());
                    break;
                case 'orders-summary':
                    $this->respond($this->getOrdersSummary());
                    break;
                case 'llms-txt':
                    if ('POST' === $method) {
                        $this->respond($this->updateLlmsTxt());
                    } else {
                        $this->respond(['content' => Configuration::get('KAELAH_LLMS_TXT')]);
                    }
                    break;
                default:
                    $this->respond(['error' => 'unknown_action'], 404);
            }
        } catch (Exception $e) {
            $this->respond(['error' => 'server_error', 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Validates the Authorization: Bearer <token> header against the token
     * issued during the OAuth-style handshake with Kaelah AI.
     */
    private function checkToken()
    {
        $stored = Configuration::get('KAELAH_ACCESS_TOKEN');
        if (empty($stored)) {
            return ['error' => 'kaelah_not_connected', 'message' => "Cette boutique n'est pas connectée à Kaelah AI."];
        }

        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $authHeader = $headers['Authorization'] ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
        if (!preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches)) {
            return ['error' => 'kaelah_missing_token', 'message' => "Jeton d'authentification manquant."];
        }
        if (!hash_equals($stored, $matches[1])) {
            return ['error' => 'kaelah_invalid_token', 'message' => "Jeton d'authentification invalide."];
        }

        return true;
    }

    private function respond($data, $status = 200)
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    private function jsonBody()
    {
        $raw = Tools::file_get_contents('php://input');
        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function getSiteInfo()
    {
        return [
            'name' => Configuration::get('PS_SHOP_NAME'),
            'url' => Tools::getShopDomainSsl(true) . __PS_BASE_URI__,
        ];
    }

    private function formatProduct(Product $product)
    {
        $idLang = $this->context->language->id;

        return [
            'id' => (int) $product->id,
            'title' => $product->name,
            'price' => (float) $product->getPrice(),
            'link' => $this->context->link->getProductLink($product),
            'seoTitle' => $product->meta_title,
            'seoDescription' => $product->meta_description,
        ];
    }

    private function getProducts()
    {
        $limit = min(50, max(1, (int) (Tools::getValue('limit') ?: 10)));
        $idLang = $this->context->language->id;
        $rows = Product::getProducts($idLang, 0, $limit, 'id_product', 'DESC', false, true, $this->context);

        $products = [];
        foreach ($rows as $row) {
            $product = new Product($row['id_product'], false, $idLang);
            if ($product->id) {
                $products[] = $this->formatProduct($product);
            }
        }

        return $products;
    }

    private function updateProductSeo($productId)
    {
        $idLang = $this->context->language->id;
        $product = new Product($productId, false, $idLang);
        if (!$product->id) {
            return ['error' => 'kaelah_not_found', 'message' => 'Produit introuvable.'];
        }

        $body = $this->jsonBody();
        if (!empty($body['seoTitle'])) {
            $product->meta_title = $body['seoTitle'];
        }
        if (!empty($body['seoDescription'])) {
            $product->meta_description = $body['seoDescription'];
        }
        $product->save();

        return $this->formatProduct(new Product($productId, false, $idLang));
    }

    private function updateProductGeo($productId)
    {
        $idLang = $this->context->language->id;
        $product = new Product($productId, false, $idLang);
        if (!$product->id) {
            return ['error' => 'kaelah_not_found', 'message' => 'Produit introuvable.'];
        }

        $body = $this->jsonBody();
        $summary = $body['conversationalSummary'] ?? null;
        $qaPairs = $body['qaPairs'] ?? null;
        $structured = $body['structuredDataSuggestion'] ?? null;

        $clean = [];
        if (is_array($qaPairs)) {
            foreach ($qaPairs as $pair) {
                if (!empty($pair['question']) && !empty($pair['answer'])) {
                    $clean[] = ['question' => $pair['question'], 'answer' => $pair['answer']];
                }
            }
        }

        Db::getInstance()->execute(
            'REPLACE INTO `' . _DB_PREFIX_ . 'kaelah_geo` (id_product, id_lang, conversational_summary, qa_pairs, structured_note) VALUES (' .
            (int) $productId . ', ' . (int) $idLang . ', \'' . pSQL($summary) . '\', \'' . pSQL(json_encode($clean)) . '\', \'' . pSQL($structured) . '\')'
        );

        return [
            'id' => $productId,
            'conversationalSummary' => $summary,
            'qaPairs' => $clean,
        ];
    }

    private function updateHomepageSeo()
    {
        $body = $this->jsonBody();
        if (!empty($body['seoTitle'])) {
            Configuration::updateValue('KAELAH_HOMEPAGE_SEO_TITLE', $body['seoTitle']);
        }
        if (!empty($body['seoDescription'])) {
            Configuration::updateValue('KAELAH_HOMEPAGE_SEO_DESCRIPTION', $body['seoDescription']);
        }

        return [
            'seoTitle' => Configuration::get('KAELAH_HOMEPAGE_SEO_TITLE'),
            'seoDescription' => Configuration::get('KAELAH_HOMEPAGE_SEO_DESCRIPTION'),
        ];
    }

    private function updateHomepageGeo()
    {
        $body = $this->jsonBody();
        if (!empty($body['conversationalSummary'])) {
            Configuration::updateValue('KAELAH_HOMEPAGE_GEO_SUMMARY', $body['conversationalSummary']);
        }
        if (!empty($body['structuredDataSuggestion'])) {
            Configuration::updateValue('KAELAH_HOMEPAGE_GEO_STRUCTURED_NOTE', $body['structuredDataSuggestion']);
        }
        if (isset($body['qaPairs']) && is_array($body['qaPairs'])) {
            $clean = [];
            foreach ($body['qaPairs'] as $pair) {
                if (!empty($pair['question']) && !empty($pair['answer'])) {
                    $clean[] = ['question' => $pair['question'], 'answer' => $pair['answer']];
                }
            }
            Configuration::updateValue('KAELAH_HOMEPAGE_GEO_QA', json_encode($clean));
        }

        return [
            'conversationalSummary' => Configuration::get('KAELAH_HOMEPAGE_GEO_SUMMARY'),
            'qaPairs' => json_decode(Configuration::get('KAELAH_HOMEPAGE_GEO_QA'), true),
        ];
    }

    private function getOrdersSummary()
    {
        $orders = Db::getInstance()->executeS(
            'SELECT total_paid_tax_incl, id_currency FROM `' . _DB_PREFIX_ . 'orders` WHERE valid = 1 ORDER BY date_add DESC LIMIT 100'
        );
        $revenue = 0;
        foreach ($orders as $order) {
            $revenue += (float) $order['total_paid_tax_incl'];
        }
        $currency = Context::getContext()->currency ? Context::getContext()->currency->iso_code : null;

        return [
            'ordersCount' => count($orders),
            'revenue' => round($revenue, 2),
            'currency' => $currency,
        ];
    }

    private function updateLlmsTxt()
    {
        $body = $this->jsonBody();
        if (!isset($body['content'])) {
            return ['error' => 'kaelah_missing_content', 'message' => 'Contenu manquant.'];
        }
        Configuration::updateValue('KAELAH_LLMS_TXT', $body['content']);

        return [
            'content' => Configuration::get('KAELAH_LLMS_TXT'),
            'url' => Tools::getShopDomainSsl(true) . __PS_BASE_URI__ . 'llms.txt',
        ];
    }
}
