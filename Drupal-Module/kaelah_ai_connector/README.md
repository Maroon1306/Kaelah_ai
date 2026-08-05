# Kaelah AI Connector

Connects this Drupal site to [Kaelah AI](https://kaelah.ai) in one click — no API key or password to copy and paste.

This module performs no SEO, GEO or AI analysis itself. All intelligence runs on Kaelah AI's own servers — this module only establishes a secure, authenticated connection so Kaelah AI can:

* read your content (nodes) and their SEO metadata, with your permission;
* apply the content and SEO updates you approve from the Kaelah AI chat interface.

## How it works

1. In Kaelah AI, go to Settings > Connectors and click "Connect" next to Drupal.
2. You land on this module's project page. Install and enable it.
3. Go to **Configuration > Web services > Kaelah AI** and click "Connecter à Kaelah AI".
4. Approve the connection on Kaelah AI's consent screen.
5. You're redirected back here, now connected — no keys or passwords ever typed.

## Requirements

* Drupal 9, 10 or 11
* The core Node module (enabled by default on a standard install)

## Security

* All communication uses HTTPS in production.
* A unique access token is issued for your site during the connection handshake and stored via Drupal's State API — never your Drupal account password.
* Every request from Kaelah AI is authenticated against that token (`Authorization: Bearer`).
* Disconnect at any time from **Configuration > Web services > Kaelah AI**.

## Notes on SEO metadata

SEO title/description overrides applied by Kaelah AI are stored via Drupal's State API, keyed per node. If your site uses the contributed **Metatag** module, you may want to extend this integration to write directly into Metatag's per-entity overrides — this module intentionally keeps its footprint minimal and does not assume a specific SEO module is installed.

## Installation

1. Install via Composer (recommended) or upload the module to `modules/contrib/kaelah_ai_connector`.
2. Enable the module: `drush en kaelah_ai_connector` (or via the standard Extend UI).
3. Grant the "Administer Kaelah AI Connector" permission to the relevant roles.
4. Go to **Configuration > Web services > Kaelah AI** and connect.
