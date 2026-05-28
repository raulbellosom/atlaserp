-- atlas.ledger tables
-- Tables were created by Atlas ORM sync; this migration uses IF NOT EXISTS
-- so it is safe to apply even if the tables already exist.

CREATE TABLE IF NOT EXISTS "ledger_account" (
    "id"              UUID NOT NULL DEFAULT uuidv7(),
    "company_id"      UUID NOT NULL,
    "name"            TEXT NOT NULL,
    "bank"            TEXT NOT NULL,
    "account_number"  TEXT,
    "currency"        TEXT NOT NULL DEFAULT 'MXN',
    "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "enabled"         BOOLEAN NOT NULL DEFAULT true,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ledger_account_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ledger_account_company_id_name_key"
    ON "ledger_account"("company_id", "name");

CREATE INDEX IF NOT EXISTS "ledger_account_company_id_enabled_idx"
    ON "ledger_account"("company_id", "enabled");

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ledger_category" (
    "id"         UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "name"       TEXT NOT NULL,
    "color"      TEXT,
    "kind"       TEXT NOT NULL DEFAULT 'both',
    "enabled"    BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ledger_category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ledger_category_company_id_name_key"
    ON "ledger_category"("company_id", "name");

CREATE INDEX IF NOT EXISTS "ledger_category_company_id_enabled_idx"
    ON "ledger_category"("company_id", "enabled");

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ledger_transaction_type" (
    "id"         UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "code"       TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "enabled"    BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ledger_transaction_type_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ledger_transaction_type_company_id_code_key"
    ON "ledger_transaction_type"("company_id", "code");

CREATE INDEX IF NOT EXISTS "ledger_transaction_type_company_id_enabled_idx"
    ON "ledger_transaction_type"("company_id", "enabled");

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "ledger_transaction" (
    "id"          UUID NOT NULL DEFAULT uuidv7(),
    "company_id"  UUID NOT NULL,
    "account_id"  UUID NOT NULL,
    "category_id" UUID,
    "tipo_id"     UUID,
    "fecha"       DATE NOT NULL,
    "numero"      TEXT,
    "nombre"      TEXT NOT NULL,
    "referencia"  TEXT,
    "concepto"    TEXT,
    "deposito"    DECIMAL(15,2),
    "retiro"      DECIMAL(15,2),
    "enabled"     BOOLEAN NOT NULL DEFAULT true,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ledger_transaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ledger_transaction_account_id_enabled_idx"
    ON "ledger_transaction"("account_id", "enabled");

CREATE INDEX IF NOT EXISTS "ledger_transaction_company_id_fecha_idx"
    ON "ledger_transaction"("company_id", "fecha");

CREATE INDEX IF NOT EXISTS "ledger_transaction_account_id_fecha_idx"
    ON "ledger_transaction"("account_id", "fecha");
