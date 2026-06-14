ALTER TABLE "website_site"
  ADD COLUMN "analytics_mode" TEXT NOT NULL DEFAULT 'off',
  ADD COLUMN "turnstile_site_key" TEXT,
  ADD COLUMN "turnstile_secret_key" TEXT;

ALTER TABLE "website_form"
  ADD COLUMN "creates_lead" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "default_assignee_user_id" UUID,
  ADD COLUMN "honeypot_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "turnstile_required" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "website_form_field"
  ADD COLUMN "semantic_key" TEXT;

ALTER TABLE "website_form_submission"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "visitor_id" UUID,
  ADD COLUMN "session_id" UUID,
  ADD COLUMN "lead_id" UUID,
  DROP COLUMN "submitter_ip";

CREATE TABLE "growth_visitor" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "company_id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "visitor_key_hash" TEXT NOT NULL,
  "consent_state" TEXT NOT NULL DEFAULT 'unknown',
  "dnt" BOOLEAN NOT NULL DEFAULT false,
  "device_family" TEXT,
  "authenticated_profile_id" UUID,
  "first_source" JSONB,
  "last_source" JSONB,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "growth_visitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "growth_session" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "company_id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "visitor_id" UUID NOT NULL,
  "session_key_hash" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "landing_path" TEXT,
  "exit_path" TEXT,
  "referrer_host" TEXT,
  "utm_source" TEXT,
  "utm_medium" TEXT,
  "utm_campaign" TEXT,
  "visible_seconds" INTEGER NOT NULL DEFAULT 0,
  "pageview_count" INTEGER NOT NULL DEFAULT 0,
  "event_count" INTEGER NOT NULL DEFAULT 0,
  "has_conversion" BOOLEAN NOT NULL DEFAULT false,
  "engaged" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "growth_session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "growth_event" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "company_id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "visitor_id" UUID,
  "session_id" UUID,
  "event_name" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "client_occurred_at" TIMESTAMP(3) NOT NULL,
  "server_received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "path" TEXT,
  "referrer" TEXT,
  "properties" JSONB,
  "source_type" TEXT,
  "form_id" UUID,
  "submission_id" UUID,
  "consent_state" TEXT NOT NULL DEFAULT 'unknown',
  CONSTRAINT "growth_event_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "growth_lead" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "company_id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "form_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'new',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "name" TEXT,
  "email" TEXT,
  "email_normalized" TEXT,
  "phone" TEXT,
  "phone_normalized" TEXT,
  "company_name" TEXT,
  "message" TEXT,
  "source" TEXT,
  "attribution" JSONB,
  "assignee_user_id" UUID,
  "contact_id" UUID,
  "first_submission_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_submission_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "qualified_at" TIMESTAMP(3),
  "converted_at" TIMESTAMP(3),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "growth_lead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "growth_lead_activity" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "company_id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "lead_id" UUID NOT NULL,
  "activity_type" TEXT NOT NULL,
  "source_type" TEXT,
  "source_id" UUID,
  "actor_user_id" UUID,
  "payload" JSONB,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "growth_lead_activity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "growth_daily_metric" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "company_id" UUID NOT NULL,
  "site_id" UUID NOT NULL,
  "metric_date" DATE NOT NULL,
  "dimension_type" TEXT NOT NULL DEFAULT 'site',
  "dimension_key" TEXT NOT NULL DEFAULT '',
  "metrics" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "growth_daily_metric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "website_form_submission_form_id_idempotency_key_key"
  ON "website_form_submission"("form_id", "idempotency_key");
CREATE INDEX "website_form_submission_company_id_submitted_at_idx"
  ON "website_form_submission"("company_id", "submitted_at");
CREATE INDEX "website_form_submission_lead_id_idx"
  ON "website_form_submission"("lead_id");

CREATE UNIQUE INDEX "growth_visitor_site_id_visitor_key_hash_key"
  ON "growth_visitor"("site_id", "visitor_key_hash");
CREATE INDEX "growth_visitor_company_id_last_seen_at_idx"
  ON "growth_visitor"("company_id", "last_seen_at");
CREATE INDEX "growth_visitor_authenticated_profile_id_idx"
  ON "growth_visitor"("authenticated_profile_id");

CREATE UNIQUE INDEX "growth_session_site_id_session_key_hash_key"
  ON "growth_session"("site_id", "session_key_hash");
CREATE INDEX "growth_session_company_id_site_id_started_at_idx"
  ON "growth_session"("company_id", "site_id", "started_at");
CREATE INDEX "growth_session_visitor_id_last_seen_at_idx"
  ON "growth_session"("visitor_id", "last_seen_at");

CREATE UNIQUE INDEX "growth_event_site_idempotency_key_key"
  ON "growth_event"("site_id", "idempotency_key");
CREATE INDEX "growth_event_company_id_site_id_server_received_at_idx"
  ON "growth_event"("company_id", "site_id", "server_received_at");
CREATE INDEX "growth_event_session_id_server_received_at_idx"
  ON "growth_event"("session_id", "server_received_at");
CREATE INDEX "growth_event_event_name_server_received_at_idx"
  ON "growth_event"("event_name", "server_received_at");
CREATE INDEX "growth_event_form_id_idx" ON "growth_event"("form_id");
CREATE INDEX "growth_event_submission_id_idx" ON "growth_event"("submission_id");

CREATE INDEX "growth_lead_company_id_status_enabled_created_at_idx"
  ON "growth_lead"("company_id", "status", "enabled", "created_at");
CREATE INDEX "growth_lead_company_id_email_normalized_status_idx"
  ON "growth_lead"("company_id", "email_normalized", "status");
CREATE INDEX "growth_lead_company_id_phone_normalized_status_idx"
  ON "growth_lead"("company_id", "phone_normalized", "status");
CREATE INDEX "growth_lead_assignee_user_id_status_idx"
  ON "growth_lead"("assignee_user_id", "status");

CREATE INDEX "growth_lead_activity_lead_id_occurred_at_idx"
  ON "growth_lead_activity"("lead_id", "occurred_at");
CREATE INDEX "growth_lead_activity_company_id_occurred_at_idx"
  ON "growth_lead_activity"("company_id", "occurred_at");

CREATE UNIQUE INDEX "growth_daily_metric_site_id_metric_date_dimension_type_dimension_key_key"
  ON "growth_daily_metric"("site_id", "metric_date", "dimension_type", "dimension_key");
CREATE INDEX "growth_daily_metric_company_id_metric_date_idx"
  ON "growth_daily_metric"("company_id", "metric_date");

ALTER TABLE "website_form"
  ADD CONSTRAINT "website_form_default_assignee_user_id_fkey"
  FOREIGN KEY ("default_assignee_user_id") REFERENCES "user_profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "growth_visitor"
  ADD CONSTRAINT "growth_visitor_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_visitor_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "website_site"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_visitor_authenticated_profile_id_fkey"
  FOREIGN KEY ("authenticated_profile_id") REFERENCES "user_profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "growth_session"
  ADD CONSTRAINT "growth_session_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_session_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "website_site"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_session_visitor_id_fkey"
  FOREIGN KEY ("visitor_id") REFERENCES "growth_visitor"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "growth_event"
  ADD CONSTRAINT "growth_event_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_event_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "website_site"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_event_visitor_id_fkey"
  FOREIGN KEY ("visitor_id") REFERENCES "growth_visitor"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_event_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "growth_session"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_event_form_id_fkey"
  FOREIGN KEY ("form_id") REFERENCES "website_form"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_event_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "website_form_submission"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "growth_lead"
  ADD CONSTRAINT "growth_lead_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_lead_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "website_site"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_lead_form_id_fkey"
  FOREIGN KEY ("form_id") REFERENCES "website_form"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_lead_assignee_user_id_fkey"
  FOREIGN KEY ("assignee_user_id") REFERENCES "user_profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_lead_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "contact"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "growth_lead_activity"
  ADD CONSTRAINT "growth_lead_activity_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_lead_activity_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "website_site"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_lead_activity_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "growth_lead"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_lead_activity_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "user_profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "growth_daily_metric"
  ADD CONSTRAINT "growth_daily_metric_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "growth_daily_metric_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "website_site"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "website_form_submission"
  ADD CONSTRAINT "website_form_submission_visitor_id_fkey"
  FOREIGN KEY ("visitor_id") REFERENCES "growth_visitor"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "website_form_submission_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "growth_session"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "website_form_submission_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "growth_lead"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
