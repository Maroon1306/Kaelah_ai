<?php
/**
 * Kaelah AI Connector — official free PrestaShop module.
 *
 * Connects this store to Kaelah AI in one click, without ever asking the
 * merchant for an API key or password. All SEO/GEO intelligence stays on
 * Kaelah's own servers — this module only exposes a secure, authenticated
 * gateway to this store's own data (products, orders) and renders back
 * whatever Kaelah decides to write (SEO titles/descriptions, GEO JSON-LD,
 * llms.txt, robots.txt allow-rules for AI crawlers).
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class Kaelahaiconnector extends Module
{
    const ROBOTS_MARKER_START = '# BEGIN Kaelah AI';
    const ROBOTS_MARKER_END = '# END Kaelah AI';

    // Where Kaelah AI is hosted. Update these two once you have a real
    // production domain — during local development they point at localhost.
    const KAELAH_APP_URL = 'https://kaelah-ai.com';
    const KAELAH_API_URL = 'https://api.kaelah-ai.com';

    public function __construct()
    {
        $this->name = 'kaelahaiconnector';
        $this->tab = 'administration';
        $this->version = '1.0.0';
        $this->author = 'Kaelah AI';
        $this->need_instance = 0;
        $this->bootstrap = true;
        $this->ps_versions_compliancy = ['min' => '1.6', 'max' => _PS_VERSION_];

        parent::__construct();

        $this->displayName = 'Kaelah AI Connector';
        $this->description = $this->l("Connecte cette boutique à Kaelah AI en un clic, sans clé API ni mot de passe à saisir. Toute l'intelligence (SEO, GEO, optimisations) reste hébergée sur les serveurs de Kaelah AI ; ce module ne fait que servir de passerelle sécurisée.");
    }

    public function install()
    {
        if (!parent::install()) {
            return false;
        }
        if (!$this->registerHook('displayHeader') || !$this->registerHook('moduleRoutes')) {
            return false;
        }
        if (!$this->createGeoTable()) {
            return false;
        }
        $this->syncRobotsTxt();

        return true;
    }

    public function uninstall()
    {
        $keys = [
            'KAELAH_ACCESS_TOKEN', 'KAELAH_CONNECTED_AT',
            'KAELAH_HOMEPAGE_SEO_TITLE', 'KAELAH_HOMEPAGE_SEO_DESCRIPTION',
            'KAELAH_HOMEPAGE_GEO_SUMMARY', 'KAELAH_HOMEPAGE_GEO_QA', 'KAELAH_HOMEPAGE_GEO_STRUCTURED_NOTE',
            'KAELAH_LLMS_TXT',
        ];
        foreach ($keys as $key) {
            Configuration::deleteByName($key);
        }
        Db::getInstance()->execute('DROP TABLE IF EXISTS `' . _DB_PREFIX_ . 'kaelah_geo`');
        $this->removeRobotsTxtBlock();

        return parent::uninstall();
    }

    private function createGeoTable()
    {
        $sql = 'CREATE TABLE IF NOT EXISTS `' . _DB_PREFIX_ . 'kaelah_geo` (
            `id_product` INT UNSIGNED NOT NULL,
            `id_lang` INT UNSIGNED NOT NULL,
            `conversational_summary` TEXT,
            `qa_pairs` TEXT,
            `structured_note` TEXT,
            PRIMARY KEY (`id_product`, `id_lang`)
        ) ENGINE=' . _MYSQL_ENGINE_ . ' DEFAULT CHARSET=utf8mb4';

        return Db::getInstance()->execute($sql);
    }

    /**
     * Appends explicit Allow rules for known AI crawlers (GPTBot, ClaudeBot,
     * PerplexityBot, Google-Extended...) to the store's real, physical
     * robots.txt file — PrestaShop generates this as a static file at install
     * time (unlike WordPress/Drupal, it isn't routed dynamically), so the
     * only reliable way to guarantee AI crawlers can read it is to edit the
     * real file directly. Idempotent: re-running replaces the previous block.
     */
    public function syncRobotsTxt()
    {
        $path = _PS_ROOT_DIR_ . '/robots.txt';
        if (!is_writable(dirname($path)) || (file_exists($path) && !is_writable($path))) {
            return false;
        }

        $current = file_exists($path) ? file_get_contents($path) : "User-agent: *\n";
        $current = $this->stripRobotsBlock($current);

        $block = self::ROBOTS_MARKER_START . "\n";
        $crawlers = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'Google-Extended', 'CCBot', 'Bytespider'];
        foreach ($crawlers as $agent) {
            $block .= "User-agent: {$agent}\nAllow: /\n";
        }
        $block .= self::ROBOTS_MARKER_END . "\n";

        return (bool) file_put_contents($path, rtrim($current) . "\n\n" . $block);
    }

    private function removeRobotsTxtBlock()
    {
        $path = _PS_ROOT_DIR_ . '/robots.txt';
        if (!file_exists($path) || !is_writable($path)) {
            return;
        }
        file_put_contents($path, $this->stripRobotsBlock(file_get_contents($path)));
    }

    private function stripRobotsBlock($content)
    {
        $pattern = '/' . preg_quote(self::ROBOTS_MARKER_START, '/') . '.*?' . preg_quote(self::ROBOTS_MARKER_END, '/') . '\n?/s';

        return preg_replace($pattern, '', $content);
    }

    /**
     * Registers this module's own friendly route for /llms.txt, served live
     * by KaelahaiconnectorLlmstxtModuleFrontController — the same role
     * robots.txt plays for classic crawlers, but written for LLMs. Requires
     * "Friendly URLs" to be enabled (Preferences > SEO & URLs), same as any
     * other PrestaShop custom route.
     */
    public function hookModuleRoutes()
    {
        return [
            'module-kaelahaiconnector-llmstxt' => [
                'controller' => 'llmstxt',
                'rule' => 'llms.txt',
                'keywords' => [],
                'params' => ['fc' => 'module', 'module' => $this->name],
            ],
        ];
    }

    /**
     * Renders whatever Kaelah AI has actually written for the current
     * page — SEO title/description override (homepage only, since product
     * SEO already renders natively via ps_product_lang.meta_title/
     * meta_description) plus GEO structured data as a real FAQPage JSON-LD
     * <script> tag, on both the homepage and individual product pages.
     */
    public function hookDisplayHeader($params)
    {
        if ($this->context->controller instanceof IndexController) {
            return $this->renderHomepageHead();
        }
        if ($this->context->controller instanceof ProductController) {
            return $this->renderProductHead();
        }

        return '';
    }

    private function renderHomepageHead()
    {
        $seoTitle = Configuration::get('KAELAH_HOMEPAGE_SEO_TITLE');
        $seoDescription = Configuration::get('KAELAH_HOMEPAGE_SEO_DESCRIPTION');
        if ($seoTitle || $seoDescription) {
            // The Classic theme's head.tpl reads {$page.meta.title} /
            // {$page.meta.description} (a nested array assigned earlier by
            // FrontController::getTemplateVarPage()), not flat top-level
            // Smarty variables — must patch that same nested structure.
            $page = $this->context->smarty->getTemplateVars('page');
            if (is_array($page)) {
                if ($seoTitle) {
                    $page['meta']['title'] = $seoTitle;
                }
                if ($seoDescription) {
                    $page['meta']['description'] = $seoDescription;
                }
                $this->context->smarty->assign('page', $page);
            }
        }

        $qaPairs = json_decode(Configuration::get('KAELAH_HOMEPAGE_GEO_QA'), true);

        return !empty($qaPairs) ? $this->renderFaqJsonLd($qaPairs) : '';
    }

    private function renderProductHead()
    {
        $idProduct = (int) Tools::getValue('id_product');
        if (!$idProduct) {
            return '';
        }
        $idLang = $this->context->language->id;
        $row = Db::getInstance()->getRow(
            'SELECT qa_pairs FROM `' . _DB_PREFIX_ . 'kaelah_geo` WHERE id_product = ' . $idProduct . ' AND id_lang = ' . (int) $idLang
        );
        if (empty($row['qa_pairs'])) {
            return '';
        }
        $qaPairs = json_decode($row['qa_pairs'], true);

        return !empty($qaPairs) ? $this->renderFaqJsonLd($qaPairs) : '';
    }

    public function renderFaqJsonLd($qaPairs)
    {
        $entities = [];
        foreach ($qaPairs as $pair) {
            if (empty($pair['question']) || empty($pair['answer'])) {
                continue;
            }
            $entities[] = [
                '@type' => 'Question',
                'name' => $pair['question'],
                'acceptedAnswer' => ['@type' => 'Answer', 'text' => $pair['answer']],
            ];
        }
        if (empty($entities)) {
            return '';
        }
        $jsonLd = [
            '@context' => 'https://schema.org',
            '@type' => 'FAQPage',
            'mainEntity' => $entities,
        ];

        return '<script type="application/ld+json">' . json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . '</script>';
    }

    private function getConnectUrl()
    {
        $callbackUrl = $this->context->link->getAdminLink('AdminModules', true) . '&configure=' . $this->name;
        $params = [
            'site_url' => Tools::getShopDomainSsl(true) . __PS_BASE_URI__,
            'site_name' => Configuration::get('PS_SHOP_NAME'),
            'callback_url' => $callbackUrl,
        ];

        return rtrim(self::KAELAH_APP_URL, '/') . '/connect/prestashop?' . http_build_query($params);
    }

    /**
     * Runs when the merchant lands back on this configuration page. If
     * Kaelah's consent screen just redirected here with a one-time
     * authorization code, exchange it server-to-server for a permanent
     * access token — mirrors the WordPress/Drupal plugin's handshake.
     */
    private function handleOAuthCallback()
    {
        $code = Tools::getValue('code');
        if (!$code) {
            return null;
        }

        $shopUrl = Tools::getShopDomainSsl(true) . __PS_BASE_URI__;

        // Uses PHP streams rather than ext/curl: curl_init() is unreliable
        // under some Windows/Apache PHP builds (fails to load even when the
        // CLI SAPI loads it fine), while allow_url_fopen streams work
        // consistently across SAPIs — same resilience choice made in the
        // WordPress plugin (WP_Http falls back to streams for the same reason).
        $payload = json_encode([
            'code' => $code,
            'shopUrl' => $shopUrl,
            'shopName' => Configuration::get('PS_SHOP_NAME'),
        ]);
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\n",
                'content' => $payload,
                'timeout' => 15,
                'ignore_errors' => true,
            ],
        ]);
        $response = @file_get_contents(rtrim(self::KAELAH_API_URL, '/') . '/api/connectors/prestashop/oauth/token', false, $context);
        $httpCode = 0;
        if (isset($http_response_header[0]) && preg_match('#HTTP/\S+\s+(\d+)#', $http_response_header[0], $m)) {
            $httpCode = (int) $m[1];
        }

        $body = json_decode((string) $response, true);
        if (200 !== $httpCode || empty($body['accessToken'])) {
            return $body['error'] ?? $this->l('La connexion à Kaelah AI a échoué.');
        }

        Configuration::updateValue('KAELAH_ACCESS_TOKEN', $body['accessToken']);
        Configuration::updateValue('KAELAH_CONNECTED_AT', date('Y-m-d H:i:s'));

        return null;
    }

    public function getContent()
    {
        $error = null;
        $justConnected = false;
        if (Tools::isSubmit('kaelahDisconnect')) {
            Configuration::deleteByName('KAELAH_ACCESS_TOKEN');
            Configuration::deleteByName('KAELAH_CONNECTED_AT');
        } elseif (Tools::isSubmit('kaelahSyncRobots')) {
            $this->syncRobotsTxt();
        } elseif (Tools::getValue('code')) {
            $error = $this->handleOAuthCallback();
            $justConnected = !$error;
        }

        $this->context->smarty->assign([
            'kaelah_is_connected' => (bool) Configuration::get('KAELAH_ACCESS_TOKEN'),
            'kaelah_just_connected' => $justConnected,
            'kaelah_connected_at' => Configuration::get('KAELAH_CONNECTED_AT'),
            'kaelah_connect_url' => $this->getConnectUrl(),
            'kaelah_error' => $error,
            'kaelah_status' => $this->buildStatusSection(),
            'kaelah_disconnect_url' => $this->context->link->getAdminLink('AdminModules') . '&configure=' . $this->name . '&kaelahDisconnect=1',
            'kaelah_sync_robots_url' => $this->context->link->getAdminLink('AdminModules') . '&configure=' . $this->name . '&kaelahSyncRobots=1',
        ]);

        return $this->display(__FILE__, 'views/templates/admin/configure.tpl');
    }

    /**
     * Read-only confirmation of what Kaelah AI has actually applied on this
     * store, read straight from where it's actually rendered/stored — never
     * guessed.
     */
    private function buildStatusSection()
    {
        $productsWithSeo = (int) Db::getInstance()->getValue(
            'SELECT COUNT(*) FROM `' . _DB_PREFIX_ . 'product_lang` WHERE meta_title IS NOT NULL AND meta_title != \'\''
        );
        $productsWithGeo = (int) Db::getInstance()->getValue(
            'SELECT COUNT(*) FROM `' . _DB_PREFIX_ . 'kaelah_geo` WHERE qa_pairs IS NOT NULL AND qa_pairs != \'\''
        );

        return [
            'homepage_seo_title' => Configuration::get('KAELAH_HOMEPAGE_SEO_TITLE'),
            'homepage_geo_qa_count' => count((array) json_decode(Configuration::get('KAELAH_HOMEPAGE_GEO_QA'), true)),
            'products_with_seo' => $productsWithSeo,
            'products_with_geo' => $productsWithGeo,
            'llms_txt_published' => (bool) Configuration::get('KAELAH_LLMS_TXT'),
            'llms_txt_url' => Tools::getShopDomainSsl(true) . __PS_BASE_URI__ . 'llms.txt',
            'robots_txt_url' => Tools::getShopDomainSsl(true) . __PS_BASE_URI__ . 'robots.txt',
        ];
    }
}
