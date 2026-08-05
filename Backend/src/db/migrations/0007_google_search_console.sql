ALTER TABLE connectors DROP CONSTRAINT connectors_provider_check;
ALTER TABLE connectors ADD CONSTRAINT connectors_provider_check
  CHECK (provider IN ('shopify', 'wordpress', 'drupal', 'bigcommerce', 'prestashop', 'wix', 'opencart', 'google_search_console'));
