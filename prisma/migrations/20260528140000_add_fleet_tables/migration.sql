-- Migration: add_fleet_tables
-- These tables already exist in the database (created by Atlas ORM sync).
-- Using CREATE TABLE IF NOT EXISTS so migration is safe to apply.

CREATE TABLE IF NOT EXISTS "fleet_vehicle_type" (
  "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id"            UUID        NOT NULL,
  "name"                  TEXT        NOT NULL,
  "description"           TEXT,
  "economic_group_number" TEXT,
  "enabled"               BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fleet_vehicle_type_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fleet_vehicle_type_company_id_enabled_idx"
  ON "fleet_vehicle_type" ("company_id", "enabled");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "fleet_vehicle_brand" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID        NOT NULL,
  "name"        TEXT        NOT NULL,
  "enabled"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fleet_vehicle_brand_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fleet_vehicle_brand_company_id_enabled_idx"
  ON "fleet_vehicle_brand" ("company_id", "enabled");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "fleet_vehicle_model" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID        NOT NULL,
  "brand_id"    UUID        NOT NULL,
  "type_id"     UUID,
  "name"        TEXT        NOT NULL,
  "year"        INTEGER,
  "enabled"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fleet_vehicle_model_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fleet_vehicle_model_company_id_brand_id_type_id_name_year_key"
  ON "fleet_vehicle_model" ("company_id", "brand_id", "type_id", "name", "year");

CREATE INDEX IF NOT EXISTS "fleet_vehicle_model_company_id_brand_id_idx"
  ON "fleet_vehicle_model" ("company_id", "brand_id");

CREATE INDEX IF NOT EXISTS "fleet_vehicle_model_company_id_type_id_idx"
  ON "fleet_vehicle_model" ("company_id", "type_id");

CREATE INDEX IF NOT EXISTS "fleet_vehicle_model_company_id_enabled_idx"
  ON "fleet_vehicle_model" ("company_id", "enabled");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "fleet_vehicle" (
  "id"                        UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id"                UUID        NOT NULL,
  "plate"                     TEXT        NOT NULL,
  "brand"                     TEXT,
  "model_name"                TEXT,
  "year"                      INTEGER,
  "vehicle_type_id"           UUID,
  "vehicle_brand_id"          UUID,
  "vehicle_model_id"          UUID,
  "economic_group_number"     TEXT,
  "economic_individual_number" TEXT,
  "color"                     TEXT,
  "status"                    TEXT        NOT NULL DEFAULT 'active',
  "driver_id"                 UUID,
  "photo_asset_id"            UUID,
  "notes"                     TEXT,
  "is_financed"               BOOLEAN     NOT NULL DEFAULT FALSE,
  "financing_institution"     TEXT,
  "financing_contract_number" TEXT,
  "financing_start_date"      DATE,
  "financing_end_date"        DATE,
  "financing_monthly_payment" DECIMAL(10, 2),
  "financing_notes"           TEXT,
  "enabled"                   BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fleet_vehicle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fleet_vehicle_company_id_plate_key"
  ON "fleet_vehicle" ("company_id", "plate");

CREATE INDEX IF NOT EXISTS "fleet_vehicle_company_id_status_idx"
  ON "fleet_vehicle" ("company_id", "status");

CREATE INDEX IF NOT EXISTS "fleet_vehicle_company_id_vehicle_model_id_idx"
  ON "fleet_vehicle" ("company_id", "vehicle_model_id");

CREATE INDEX IF NOT EXISTS "fleet_vehicle_company_id_vehicle_type_id_idx"
  ON "fleet_vehicle" ("company_id", "vehicle_type_id");

CREATE INDEX IF NOT EXISTS "fleet_vehicle_company_id_vehicle_brand_id_idx"
  ON "fleet_vehicle" ("company_id", "vehicle_brand_id");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "fleet_vehicle_document" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id"    UUID        NOT NULL,
  "vehicle_id"    UUID        NOT NULL,
  "file_asset_id" UUID,
  "document_type" TEXT        DEFAULT 'document',
  "label"         TEXT,
  "enabled"       BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fleet_vehicle_document_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fleet_vehicle_document_company_id_vehicle_id_idx"
  ON "fleet_vehicle_document" ("company_id", "vehicle_id");

CREATE INDEX IF NOT EXISTS "fleet_vehicle_document_company_id_file_asset_id_idx"
  ON "fleet_vehicle_document" ("company_id", "file_asset_id");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "fleet_driver" (
  "id"                  UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id"          UUID        NOT NULL,
  "first_name"          TEXT        NOT NULL,
  "last_name"           TEXT        NOT NULL,
  "phone"               TEXT        NOT NULL,
  "email"               TEXT,
  "photo_asset_id"      UUID,
  "hr_employee_id"      UUID,
  "license_number"      TEXT        NOT NULL,
  "license_type"        TEXT,
  "license_expiry_date" DATE,
  "status"              TEXT        NOT NULL DEFAULT 'active',
  "notes"               TEXT,
  "enabled"             BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fleet_driver_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fleet_driver_company_id_license_number_key"
  ON "fleet_driver" ("company_id", "license_number");

CREATE INDEX IF NOT EXISTS "fleet_driver_company_id_enabled_idx"
  ON "fleet_driver" ("company_id", "enabled");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "fleet_driver_document" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id"    UUID        NOT NULL,
  "driver_id"     UUID        NOT NULL,
  "file_asset_id" UUID,
  "document_type" TEXT        DEFAULT 'document',
  "label"         TEXT,
  "enabled"       BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fleet_driver_document_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fleet_driver_document_company_id_driver_id_idx"
  ON "fleet_driver_document" ("company_id", "driver_id");

CREATE INDEX IF NOT EXISTS "fleet_driver_document_company_id_file_asset_id_idx"
  ON "fleet_driver_document" ("company_id", "file_asset_id");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "fleet_report" (
  "id"                     UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id"             UUID        NOT NULL,
  "vehicle_id"             UUID,
  "report_type"            TEXT        NOT NULL,
  "folio"                  TEXT,
  "status"                 TEXT        NOT NULL DEFAULT 'draft',
  "title"                  TEXT,
  "report_date"            DATE        NOT NULL,
  "odometer_km"            INTEGER,
  "is_inhouse_workshop"    BOOLEAN     NOT NULL DEFAULT TRUE,
  "workshop_name"          TEXT,
  "workshop_phone"         TEXT,
  "workshop_address"       TEXT,
  "invoice_number"         TEXT,
  "labor_cost"             DECIMAL(10, 2),
  "parts_cost"             DECIMAL(10, 2),
  "total_cost"             DECIMAL(10, 2),
  "notes"                  TEXT,
  "finalized_at"           TIMESTAMPTZ,
  "finalized_by_profile_id" UUID,
  "maintenance_subtype"    TEXT,
  "next_service_date"      DATE,
  "next_service_odometer"  INTEGER,
  "service_subtype"        TEXT,
  "repair_priority"        TEXT,
  "repair_damage_type"     TEXT,
  "repair_start_date"      DATE,
  "repair_completion_date" DATE,
  "repair_estimated_cost"  DECIMAL(10, 2),
  "warranty_days"          INTEGER,
  "warranty_notes"         TEXT,
  "other_category_label"   TEXT,
  "enabled"                BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fleet_report_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fleet_report_company_id_folio_key"
  ON "fleet_report" ("company_id", "folio");

CREATE INDEX IF NOT EXISTS "fleet_report_company_id_vehicle_id_idx"
  ON "fleet_report" ("company_id", "vehicle_id");

CREATE INDEX IF NOT EXISTS "fleet_report_company_id_report_type_idx"
  ON "fleet_report" ("company_id", "report_type");

CREATE INDEX IF NOT EXISTS "fleet_report_company_id_status_idx"
  ON "fleet_report" ("company_id", "status");

CREATE INDEX IF NOT EXISTS "fleet_report_company_id_report_date_idx"
  ON "fleet_report" ("company_id", "report_date");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "fleet_report_part" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id"  UUID        NOT NULL,
  "report_id"   UUID        NOT NULL,
  "name"        TEXT        NOT NULL,
  "quantity"    INTEGER     NOT NULL DEFAULT 1,
  "unit_cost"   DECIMAL(10, 2),
  "subtotal"    DECIMAL(10, 2),
  "notes"       TEXT,
  "enabled"     BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fleet_report_part_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fleet_report_part_company_id_report_id_idx"
  ON "fleet_report_part" ("company_id", "report_id");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "fleet_report_document" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id"    UUID        NOT NULL,
  "report_id"     UUID        NOT NULL,
  "file_asset_id" UUID,
  "document_type" TEXT        DEFAULT 'document',
  "label"         TEXT,
  "enabled"       BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fleet_report_document_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "fleet_report_document_company_id_report_id_idx"
  ON "fleet_report_document" ("company_id", "report_id");

CREATE INDEX IF NOT EXISTS "fleet_report_document_company_id_file_asset_id_idx"
  ON "fleet_report_document" ("company_id", "file_asset_id");

-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "fleet_insurance_policy" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "company_id"        UUID        NOT NULL,
  "vehicle_id"        UUID,
  "insurer_name"      TEXT        NOT NULL,
  "policy_number"     TEXT        NOT NULL,
  "coverage_type"     TEXT,
  "start_date"        DATE,
  "expiry_date"       DATE,
  "premium"           DECIMAL(10, 2),
  "currency"          TEXT        DEFAULT 'MXN',
  "notes"             TEXT,
  "document_asset_id" UUID,
  "enabled"           BOOLEAN     NOT NULL DEFAULT TRUE,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "fleet_insurance_policy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fleet_insurance_policy_company_id_policy_number_key"
  ON "fleet_insurance_policy" ("company_id", "policy_number");

CREATE INDEX IF NOT EXISTS "fleet_insurance_policy_company_id_vehicle_id_idx"
  ON "fleet_insurance_policy" ("company_id", "vehicle_id");

CREATE INDEX IF NOT EXISTS "fleet_insurance_policy_company_id_expiry_date_idx"
  ON "fleet_insurance_policy" ("company_id", "expiry_date");
