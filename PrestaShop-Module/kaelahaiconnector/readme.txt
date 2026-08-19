=== Kaelah AI Connector ===
Compatible with: PrestaShop 1.6 – 8.x
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Connect your PrestaShop store to Kaelah AI in one click — no API key or password to copy and paste.

== Description ==

Kaelah AI Connector is the official bridge between your PrestaShop store and Kaelah AI (https://kaelah-ai.com), a conversational AI assistant that helps you manage and optimize your online business.

This module does not perform any SEO, GEO or AI analysis itself. All intelligence runs on Kaelah AI's own servers — this module only establishes a secure, authenticated connection so Kaelah AI can:

* read your products, prices and their SEO metadata (with your permission);
* apply the SEO and GEO updates you approve from the Kaelah AI chat interface.

= How it works =

1. In Kaelah AI, go to Settings > Connectors and click "Connect" next to PrestaShop.
2. The module downloads directly from Kaelah AI. Install it from Modules > Module Manager > Upload a module.
3. Open Modules > Kaelah AI Connector > Configure, and click "Connecter à Kaelah AI".
4. You'll be asked to approve the connection on Kaelah AI. Approve it.
5. You're redirected back here, now connected — no keys or passwords ever typed.

= Security =

* All communication uses HTTPS.
* A unique access token is issued for your store during the connection handshake and stored locally; it is never your PrestaShop admin password.
* Every request from Kaelah AI is authenticated against that token.
* You can disconnect at any time from the module's configuration page.

== Installation ==

1. Download the module from Kaelah AI's connectors page and install it from Modules > Module Manager > Upload a module.
2. Go to Modules > Kaelah AI Connector > Configure.
3. Click "Connecter à Kaelah AI".

== Frequently Asked Questions ==

= Does this module do anything on its own? =

No. It only relays authenticated requests between your store and Kaelah AI. All decisions (what to change, SEO scoring, content generation) happen on Kaelah AI's platform.

= Does llms.txt require anything special? =

Yes — "Friendly URLs" must be enabled under Preferences > SEO & URLs for /llms.txt to be served.

= Can I disconnect? =

Yes, at any time, from the module's configuration page.

== Changelog ==

= 1.0.0 =
* Initial release.
