-- atlas.website tables — managed by Prisma (migrated from Atlas ORM)

-- CreateTable
CREATE TABLE "website_site" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "default_locale" TEXT NOT NULL DEFAULT 'es',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "homepage_page_id" UUID,
    "theme_id" UUID,
    "settings" JSONB,
    "seo_defaults" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_page" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "route_path" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "page_type" TEXT NOT NULL DEFAULT 'page',
    "draft_builder_data" JSONB,
    "published_builder_data" JSONB,
    "seo" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "published_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_page_version" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "builder_data" JSONB,
    "seo" JSONB,
    "status" TEXT NOT NULL DEFAULT 'snapshot',
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_page_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_theme" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tokens" JSONB,
    "typography" JSONB,
    "layout" JSONB,
    "custom_css" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_menu" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'header',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_menu_item" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "menu_id" UUID NOT NULL,
    "parent_id" UUID,
    "label" TEXT NOT NULL,
    "url" TEXT,
    "page_id" UUID,
    "target" TEXT NOT NULL DEFAULT '_self',
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_menu_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_published_render" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "html" TEXT,
    "title" TEXT,
    "description" TEXT,
    "og_image" TEXT,
    "status_code" INTEGER NOT NULL DEFAULT 200,
    "content_hash" TEXT,
    "published_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_published_render_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_site_company_id_enabled_idx" ON "website_site"("company_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "website_page_company_id_site_id_route_path_key" ON "website_page"("company_id", "site_id", "route_path");

-- CreateIndex
CREATE INDEX "website_page_company_id_status_idx" ON "website_page"("company_id", "status");

-- CreateIndex
CREATE INDEX "website_page_version_page_id_idx" ON "website_page_version"("page_id");

-- CreateIndex
CREATE INDEX "website_theme_company_id_site_id_enabled_idx" ON "website_theme"("company_id", "site_id", "enabled");

-- CreateIndex
CREATE INDEX "website_menu_company_id_site_id_enabled_idx" ON "website_menu"("company_id", "site_id", "enabled");

-- CreateIndex
CREATE INDEX "website_menu_item_menu_id_enabled_idx" ON "website_menu_item"("menu_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "website_published_render_site_id_path_key" ON "website_published_render"("site_id", "path");

-- CreateIndex
CREATE INDEX "website_published_render_company_id_site_id_idx" ON "website_published_render"("company_id", "site_id");
