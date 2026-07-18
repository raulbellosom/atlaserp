CREATE TABLE "pos_modifier_group" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "min_select" INTEGER NOT NULL DEFAULT 0,
    "max_select" INTEGER NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pos_modifier_group_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pos_modifier_group_company_id_product_id_name_key" ON "pos_modifier_group"("company_id", "product_id", "name");
CREATE INDEX "pos_modifier_group_company_id_product_id_enabled_idx" ON "pos_modifier_group"("company_id", "product_id", "enabled");

CREATE TABLE "pos_modifier_option" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pos_modifier_option_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pos_modifier_option_group_id_enabled_idx" ON "pos_modifier_option"("group_id", "enabled");
ALTER TABLE "pos_modifier_option" ADD CONSTRAINT "pos_modifier_option_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "pos_modifier_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pos_order_line_modifier" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "group_name" TEXT NOT NULL,
    "option_name" TEXT NOT NULL,
    "price_delta" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT "pos_order_line_modifier_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pos_order_line_modifier_line_id_idx" ON "pos_order_line_modifier"("line_id");
ALTER TABLE "pos_order_line_modifier" ADD CONSTRAINT "pos_order_line_modifier_line_id_fkey"
    FOREIGN KEY ("line_id") REFERENCES "pos_order_line"("id") ON DELETE CASCADE ON UPDATE CASCADE;
