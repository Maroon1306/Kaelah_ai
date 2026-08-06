ALTER TABLE company_members ADD COLUMN invite_token_hash TEXT;
ALTER TABLE company_members ADD COLUMN invite_expires_at TIMESTAMPTZ;
ALTER TABLE company_members ALTER COLUMN status SET DEFAULT 'invited';
