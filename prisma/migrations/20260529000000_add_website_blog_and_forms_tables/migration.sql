-- atlas.website blog and forms tables

-- CreateTable: website_blog_category
CREATE TABLE "website_blog_category" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_blog_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable: website_blog_post
CREATE TABLE "website_blog_post" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "category_id" UUID,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "featured_image" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "draft_builder_data" JSONB,
    "published_builder_data" JSONB,
    "seo" JSONB,
    "published_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_blog_post_pkey" PRIMARY KEY ("id")
);

-- CreateTable: website_form
CREATE TABLE "website_form" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "submit_label" TEXT NOT NULL DEFAULT 'Enviar',
    "success_message" TEXT,
    "notify_email" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_form_pkey" PRIMARY KEY ("id")
);

-- CreateTable: website_form_field
CREATE TABLE "website_form_field" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "field_type" TEXT NOT NULL DEFAULT 'text',
    "placeholder" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_form_field_pkey" PRIMARY KEY ("id")
);

-- CreateTable: website_form_submission
CREATE TABLE "website_form_submission" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "form_id" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "submitter_ip" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_form_submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "website_blog_category_company_id_site_id_slug_key" ON "website_blog_category"("company_id", "site_id", "slug");
CREATE INDEX "website_blog_category_company_id_site_id_enabled_idx" ON "website_blog_category"("company_id", "site_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "website_blog_post_company_id_site_id_slug_key" ON "website_blog_post"("company_id", "site_id", "slug");
CREATE INDEX "website_blog_post_company_id_site_id_status_enabled_idx" ON "website_blog_post"("company_id", "site_id", "status", "enabled");

-- CreateIndex
CREATE INDEX "website_form_company_id_site_id_enabled_idx" ON "website_form"("company_id", "site_id", "enabled");
CREATE INDEX "website_form_field_form_id_enabled_idx" ON "website_form_field"("form_id", "enabled");
CREATE INDEX "website_form_submission_form_id_submitted_at_idx" ON "website_form_submission"("form_id", "submitted_at");

-- AddForeignKey
ALTER TABLE "website_blog_post" ADD CONSTRAINT "website_blog_post_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "website_blog_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_form_field" ADD CONSTRAINT "website_form_field_form_id_fkey"
    FOREIGN KEY ("form_id") REFERENCES "website_form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_form_submission" ADD CONSTRAINT "website_form_submission_form_id_fkey"
    FOREIGN KEY ("form_id") REFERENCES "website_form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
