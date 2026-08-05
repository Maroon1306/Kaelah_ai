ALTER TABLE companies ADD COLUMN notification_prefs JSONB NOT NULL DEFAULT '{"email": true, "weekly": true}';
ALTER TABLE companies ADD COLUMN ai_preferences JSONB NOT NULL DEFAULT '{"tone": "professional", "autoActions": false}';
