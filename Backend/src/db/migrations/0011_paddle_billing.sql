-- Swap Stripe for Paddle as the payment provider. Safe to drop the old
-- columns outright: STRIPE_SECRET_KEY was never configured in production, so
-- no real customer ever got a stripe_customer_id.
ALTER TABLE companies DROP COLUMN stripe_customer_id;
ALTER TABLE companies DROP COLUMN stripe_subscription_id;
ALTER TABLE companies ADD COLUMN paddle_customer_id TEXT;
ALTER TABLE companies ADD COLUMN paddle_subscription_id TEXT;
