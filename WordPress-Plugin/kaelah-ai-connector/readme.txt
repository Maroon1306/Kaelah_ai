=== Kaelah AI Connector ===
Contributors: kaelahai
Tags: ai, seo, automation, connector, ecommerce
Requires at least: 5.6
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Connect your WordPress site to Kaelah AI in one click — no API key or application password to copy and paste.

== Description ==

Kaelah AI Connector is the official bridge between your WordPress site and [Kaelah AI](https://kaelah.ai), a conversational AI assistant that helps you manage and optimize your online business.

This plugin does not perform any SEO, GEO or AI analysis itself. All intelligence runs on Kaelah AI's own servers — this plugin only establishes a secure, authenticated connection so Kaelah AI can:

* read your posts, pages and their SEO metadata (with your permission);
* apply the content and SEO updates you approve from the Kaelah AI chat interface.

= How it works =

1. In Kaelah AI, go to Settings > Connectors and click "Connect" next to WordPress.
2. You'll land on this plugin's page. Install and activate it.
3. Open the "Kaelah AI" menu in your WordPress admin and click "Connecter à Kaelah AI".
4. You'll be asked to approve the connection on Kaelah AI. Approve it.
5. You're redirected back here, now connected — no keys or passwords ever typed.

= Security =

* All communication uses HTTPS.
* A unique access token is issued for your site during the connection handshake and stored locally; it is never your WordPress password.
* Every request from Kaelah AI is authenticated against that token.
* You can disconnect at any time from the "Kaelah AI" admin page.

== Installation ==

1. Upload the plugin files to `/wp-content/plugins/kaelah-ai-connector`, or install directly from the WordPress plugin directory.
2. Activate the plugin through the "Plugins" screen.
3. Go to the "Kaelah AI" menu and click "Connecter à Kaelah AI".

== Frequently Asked Questions ==

= Does this plugin do anything on its own? =

No. It only relays authenticated requests between your site and Kaelah AI. All decisions (what to change, SEO scoring, content generation) happen on Kaelah AI's platform.

= Can I disconnect? =

Yes, at any time, from the "Kaelah AI" admin page.

== Changelog ==

= 1.0.0 =
* Initial release.
