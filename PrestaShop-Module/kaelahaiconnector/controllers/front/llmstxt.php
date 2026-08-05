<?php
/**
 * Serves the markdown Kaelah AI has generated live at /llms.txt (registered
 * as a friendly route via Kaelahaiconnector::hookModuleRoutes()) — the
 * llms.txt equivalent of robots.txt, written for LLMs rather than crawlers.
 */

if (!defined('_PS_VERSION_')) {
    exit;
}

class KaelahaiconnectorLlmstxtModuleFrontController extends ModuleFrontController
{
    public function initContent()
    {
        header('Content-Type: text/plain; charset=utf-8');
        echo Configuration::get('KAELAH_LLMS_TXT') ?: '';
        exit;
    }
}
