-- CreateTable: atlas.inventory module (10 tables)

CREATE TABLE "inv_category" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "icon" VARCHAR(50),
    "color" VARCHAR(7),
    "parent_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inv_category_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inv_brand" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "website" VARCHAR(255),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inv_brand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inv_location" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "address" VARCHAR(500),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inv_location_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inv_item" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "asset_tag" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(2000),
    "category_id" UUID,
    "brand_id" UUID,
    "location_id" UUID,
    "serial_number" VARCHAR(255),
    "model" VARCHAR(255),
    "part_number" VARCHAR(255),
    "status" VARCHAR(50) NOT NULL DEFAULT 'available',
    "purchase_date" DATE,
    "purchase_price" DECIMAL(12,2),
    "vendor_name" VARCHAR(255),
    "invoice_number" VARCHAR(100),
    "warranty_expiry" DATE,
    "warranty_notes" VARCHAR(500),
    "license_key" VARCHAR(500),
    "license_expiry" DATE,
    "license_seats" INTEGER,
    "assigned_to_id" UUID,
    "assigned_at" TIMESTAMP(3),
    "notes" VARCHAR(2000),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inv_item_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inv_assignment" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "item_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "assigned_by_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returned_at" TIMESTAMP(3),
    "notes" VARCHAR(500),

    CONSTRAINT "inv_assignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inv_custom_field" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "category_id" UUID,
    "label" VARCHAR(100) NOT NULL,
    "field_key" VARCHAR(50) NOT NULL,
    "field_type" VARCHAR(30) NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inv_custom_field_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inv_custom_field_value" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "item_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "value" VARCHAR(2000),

    CONSTRAINT "inv_custom_field_value_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inv_comment" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "item_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" VARCHAR(5000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),

    CONSTRAINT "inv_comment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inv_mention" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "comment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inv_mention_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inv_comment_reaction" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "comment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "emoji" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inv_comment_reaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inv_item_file" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "item_id" UUID NOT NULL,
    "file_asset_id" UUID NOT NULL,
    "label" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inv_item_file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inv_category_company_id_name_key" ON "inv_category"("company_id", "name");
CREATE INDEX "inv_category_company_id_idx" ON "inv_category"("company_id");

CREATE UNIQUE INDEX "inv_brand_company_id_name_key" ON "inv_brand"("company_id", "name");
CREATE INDEX "inv_brand_company_id_idx" ON "inv_brand"("company_id");

CREATE UNIQUE INDEX "inv_location_company_id_name_key" ON "inv_location"("company_id", "name");
CREATE INDEX "inv_location_company_id_idx" ON "inv_location"("company_id");

CREATE UNIQUE INDEX "inv_item_company_id_asset_tag_key" ON "inv_item"("company_id", "asset_tag");
CREATE INDEX "inv_item_company_id_idx" ON "inv_item"("company_id");
CREATE INDEX "inv_item_category_id_idx" ON "inv_item"("category_id");
CREATE INDEX "inv_item_assigned_to_id_idx" ON "inv_item"("assigned_to_id");
CREATE INDEX "inv_item_status_idx" ON "inv_item"("status");

CREATE INDEX "inv_assignment_item_id_idx" ON "inv_assignment"("item_id");
CREATE INDEX "inv_assignment_employee_id_idx" ON "inv_assignment"("employee_id");

CREATE UNIQUE INDEX "inv_custom_field_company_id_field_key_category_id_key" ON "inv_custom_field"("company_id", "field_key", "category_id");
CREATE INDEX "inv_custom_field_company_id_idx" ON "inv_custom_field"("company_id");
CREATE INDEX "inv_custom_field_category_id_idx" ON "inv_custom_field"("category_id");

CREATE UNIQUE INDEX "inv_custom_field_value_item_id_field_id_key" ON "inv_custom_field_value"("item_id", "field_id");
CREATE INDEX "inv_custom_field_value_item_id_idx" ON "inv_custom_field_value"("item_id");

CREATE INDEX "inv_comment_item_id_idx" ON "inv_comment"("item_id");

CREATE UNIQUE INDEX "inv_mention_comment_id_user_id_key" ON "inv_mention"("comment_id", "user_id");
CREATE INDEX "inv_mention_comment_id_idx" ON "inv_mention"("comment_id");
CREATE INDEX "inv_mention_user_id_idx" ON "inv_mention"("user_id");

CREATE UNIQUE INDEX "inv_comment_reaction_comment_id_user_id_emoji_key" ON "inv_comment_reaction"("comment_id", "user_id", "emoji");
CREATE INDEX "inv_comment_reaction_comment_id_idx" ON "inv_comment_reaction"("comment_id");

CREATE INDEX "inv_item_file_item_id_idx" ON "inv_item_file"("item_id");

-- AddForeignKey
ALTER TABLE "inv_category" ADD CONSTRAINT "inv_category_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inv_category" ADD CONSTRAINT "inv_category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "inv_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inv_brand" ADD CONSTRAINT "inv_brand_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inv_location" ADD CONSTRAINT "inv_location_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inv_item" ADD CONSTRAINT "inv_item_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inv_item" ADD CONSTRAINT "inv_item_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inv_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inv_item" ADD CONSTRAINT "inv_item_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "inv_brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inv_item" ADD CONSTRAINT "inv_item_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "inv_location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inv_item" ADD CONSTRAINT "inv_item_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "hr_employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inv_item" ADD CONSTRAINT "inv_item_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inv_assignment" ADD CONSTRAINT "inv_assignment_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inv_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inv_assignment" ADD CONSTRAINT "inv_assignment_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inv_assignment" ADD CONSTRAINT "inv_assignment_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inv_custom_field" ADD CONSTRAINT "inv_custom_field_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inv_custom_field" ADD CONSTRAINT "inv_custom_field_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inv_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inv_custom_field_value" ADD CONSTRAINT "inv_custom_field_value_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inv_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inv_custom_field_value" ADD CONSTRAINT "inv_custom_field_value_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "inv_custom_field"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inv_comment" ADD CONSTRAINT "inv_comment_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inv_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inv_comment" ADD CONSTRAINT "inv_comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inv_mention" ADD CONSTRAINT "inv_mention_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "inv_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inv_mention" ADD CONSTRAINT "inv_mention_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inv_comment_reaction" ADD CONSTRAINT "inv_comment_reaction_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "inv_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inv_comment_reaction" ADD CONSTRAINT "inv_comment_reaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inv_item_file" ADD CONSTRAINT "inv_item_file_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inv_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inv_item_file" ADD CONSTRAINT "inv_item_file_file_asset_id_fkey" FOREIGN KEY ("file_asset_id") REFERENCES "file_asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
