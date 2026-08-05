<?php
/**
 * Plugin Name:       Kaelah AI Connector
 * Plugin URI:        https://kaelah.ai
 * Description:       Connecte votre site WordPress à Kaelah AI en un clic, sans clé API ni mot de passe à saisir. Toute l'intelligence (SEO, GEO, optimisations) reste hébergée sur les serveurs de Kaelah AI ; ce plugin ne fait que servir de passerelle sécurisée.
 * Version:           1.0.0
 * Requires at least: 5.6
 * Requires PHP:      7.4
 * Author:            Kaelah AI
 * Author URI:        https://kaelah.ai
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       kaelah-ai-connector
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

// Where Kaelah AI is hosted. Update these two constants once you have a real
// production domain — during local development they point at localhost.
if ( ! defined( 'KAELAH_APP_URL' ) ) {
	define( 'KAELAH_APP_URL', 'http://localhost:5173' );
}
if ( ! defined( 'KAELAH_API_URL' ) ) {
	define( 'KAELAH_API_URL', 'http://localhost:4000' );
}

define( 'KAELAH_CONNECTOR_VERSION', '1.0.0' );
define( 'KAELAH_CONNECTOR_PATH', plugin_dir_path( __FILE__ ) );

require_once KAELAH_CONNECTOR_PATH . 'includes/class-kaelah-admin.php';
require_once KAELAH_CONNECTOR_PATH . 'includes/class-kaelah-rest-controller.php';
require_once KAELAH_CONNECTOR_PATH . 'includes/class-kaelah-frontend.php';
require_once KAELAH_CONNECTOR_PATH . 'includes/class-kaelah-llms-txt.php';

function kaelah_connector_init() {
	Kaelah_Admin::instance();
	Kaelah_Rest_Controller::instance();
	Kaelah_Frontend::instance();
	Kaelah_Llms_Txt::instance();
}
add_action( 'plugins_loaded', 'kaelah_connector_init' );

register_uninstall_hook( __FILE__, 'kaelah_connector_uninstall' );
function kaelah_connector_uninstall() {
	delete_option( 'kaelah_access_token' );
	delete_option( 'kaelah_connected_at' );
	delete_option( 'kaelah_site_id' );
	delete_option( 'kaelah_homepage_seo_title' );
	delete_option( 'kaelah_homepage_seo_description' );
	delete_option( 'kaelah_homepage_geo_summary' );
	delete_option( 'kaelah_homepage_geo_qa' );
	delete_option( 'kaelah_homepage_geo_structured_note' );
	delete_option( 'kaelah_llms_txt' );
}
