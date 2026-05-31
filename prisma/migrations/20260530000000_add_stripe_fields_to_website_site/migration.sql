-- Add Stripe payment fields and site_type to website_site
ALTER TABLE website_site
  ADD COLUMN IF NOT EXISTS site_type            TEXT NOT NULL DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT,
  ADD COLUMN IF NOT EXISTS stripe_secret_key     TEXT,
  ADD COLUMN IF NOT EXISTS stripe_currency       TEXT NOT NULL DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS stripe_success_message TEXT;
