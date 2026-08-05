DELETE FROM connectors WHERE provider IN ('facebook', 'instagram', 'whatsapp');

ALTER TABLE connectors DROP CONSTRAINT connectors_provider_check;
ALTER TABLE connectors ADD CONSTRAINT connectors_provider_check
  CHECK (provider IN ('shopify', 'wordpress', 'drupal', 'woocommerce', 'bigcommerce', 'prestashop', 'wix', 'opencart'));
