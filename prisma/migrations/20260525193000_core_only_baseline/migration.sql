/*
  Core-only baseline after reset-0.
  Excludes finance, ledger and fleet tables from initial instance.
*/
CREATE SCHEMA IF NOT EXISTS public;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.uuidv7(ts timestamptz DEFAULT clock_timestamp()) RETURNS uuid
LANGUAGE sql
VOLATILE
PARALLEL SAFE
SET search_path = public, pg_catalog
AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid()) placing
          substring(int8send((extract(epoch from ts)*1000)::bigint) from 3)
          from 1 for 6),
      52, 1),
    53, 1), 'hex')::uuid;
$$;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "module_kind" AS ENUM ('CORE', 'FEATURE', 'INTEGRATION', 'WEBSITE');

-- CreateEnum
CREATE TYPE "module_status" AS ENUM ('INSTALLED', 'DISABLED', 'UNINSTALLED', 'ERROR');

-- CreateEnum
CREATE TYPE "blueprint_kind" AS ENUM ('ENTITY', 'FORM', 'TABLE', 'DASHBOARD', 'ACTION', 'RELATION', 'PERMISSION');

-- CreateEnum
CREATE TYPE "file_visibility" AS ENUM ('PRIVATE', 'INTERNAL', 'PUBLIC');

-- CreateTable
CREATE TABLE "atlas_module" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL,
    "kind" "module_kind" NOT NULL DEFAULT 'FEATURE',
    "status" "module_status" NOT NULL DEFAULT 'INSTALLED',
    "core" BOOLEAN NOT NULL DEFAULT false,
    "uninstallable" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "manifest" JSONB NOT NULL,
    "lifecycle_config" JSONB,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atlas_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_dependency" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "dependency_id" UUID NOT NULL,
    "version_range" TEXT,
    "optional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "module_dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blueprint" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "module_id" UUID NOT NULL,
    "kind" "blueprint_kind" NOT NULL,
    "version" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blueprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_model" (
    "id" UUID NOT NULL,
    "module_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "plural_label" TEXT,
    "company_scoped" BOOLEAN NOT NULL DEFAULT true,
    "schema" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atlas_model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_field" (
    "id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "readonly" BOOLEAN NOT NULL DEFAULT false,
    "default_value" JSONB,
    "options" JSONB,
    "relation" JSONB,
    "validation" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "atlas_field_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atlas_view" (
    "id" UUID NOT NULL,
    "module_key" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "model_name" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "schema" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atlas_view_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "module_migration" (
    "id" UUID NOT NULL,
    "module_key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_migration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legal_name" TEXT,
    "rfc" TEXT,
    "company_type" TEXT,
    "company_type_name" TEXT,
    "industry_key" TEXT,
    "industry_name" TEXT,
    "company_size" TEXT,
    "contact_email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "colony" TEXT,
    "street" TEXT,
    "ext_number" TEXT,
    "int_number" TEXT,
    "postal_code" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profile" (
    "id" UUID NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "first_name" TEXT NOT NULL DEFAULT '',
    "last_name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "avatar_file_id" UUID,
    "birth_date" TIMESTAMP(3),
    "gender" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "colony" TEXT,
    "street" TEXT,
    "ext_number" TEXT,
    "int_number" TEXT,
    "postal_code" TEXT,
    "bio" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_table_preference" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "table_key" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_table_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module_id" UUID,
    "module_key" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_asset" (
    "id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "visibility" "file_visibility" NOT NULL DEFAULT 'PRIVATE',
    "module_key" TEXT,
    "entity_type" TEXT,
    "entity_id" UUID,
    "uploaded_by_id" UUID,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "module_key" TEXT,
    "entity_type" TEXT,
    "entity_id" UUID,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact" (
    "id" UUID NOT NULL,
    "company_id" UUID,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "tax_id" TEXT,
    "notes_markdown" TEXT,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employee" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_profile_id" UUID,
    "supervisor_employee_id" UUID,
    "department_id" UUID,
    "job_title_id" UUID,
    "profile_image_file_id" UUID,
    "employee_code" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "work_email" TEXT,
    "personal_email" TEXT,
    "phone" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "job_title" TEXT,
    "department" TEXT,
    "manager_name" TEXT,
    "employment_type" TEXT,
    "work_location" TEXT,
    "hire_date" TIMESTAMP(3),
    "termination_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes_markdown" TEXT,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_department" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_job_title" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hr_job_title_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instance_config" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instance_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branding_config" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "primary_color" TEXT NOT NULL,
    "logo_file_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branding_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID,
    "kind" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preference" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "atlas_module_key_key" ON "atlas_module"("key");

-- CreateIndex
CREATE INDEX "atlas_module_status_enabled_idx" ON "atlas_module"("status", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "module_dependency_module_id_dependency_id_key" ON "module_dependency"("module_id", "dependency_id");

-- CreateIndex
CREATE UNIQUE INDEX "blueprint_key_key" ON "blueprint"("key");

-- CreateIndex
CREATE INDEX "blueprint_module_id_idx" ON "blueprint"("module_id");

-- CreateIndex
CREATE INDEX "blueprint_enabled_idx" ON "blueprint"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "atlas_model_name_key" ON "atlas_model"("name");

-- CreateIndex
CREATE UNIQUE INDEX "atlas_model_table_name_key" ON "atlas_model"("table_name");

-- CreateIndex
CREATE INDEX "atlas_model_module_key_idx" ON "atlas_model"("module_key");

-- CreateIndex
CREATE UNIQUE INDEX "atlas_field_model_id_name_key" ON "atlas_field"("model_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "atlas_view_key_key" ON "atlas_view"("key");

-- CreateIndex
CREATE INDEX "atlas_view_module_key_idx" ON "atlas_view"("module_key");

-- CreateIndex
CREATE INDEX "atlas_view_model_name_idx" ON "atlas_view"("model_name");

-- CreateIndex
CREATE UNIQUE INDEX "module_migration_module_key_filename_key" ON "module_migration"("module_key", "filename");

-- CreateIndex
CREATE UNIQUE INDEX "company_slug_key" ON "company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_auth_user_id_key" ON "user_profile"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_profile_email_key" ON "user_profile"("email");

-- CreateIndex
CREATE INDEX "user_table_preference_user_id_idx" ON "user_table_preference"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_table_preference_user_id_table_key_key" ON "user_table_preference"("user_id", "table_key");

-- CreateIndex
CREATE INDEX "membership_user_id_enabled_idx" ON "membership"("user_id", "enabled");

-- CreateIndex
CREATE INDEX "membership_company_id_idx" ON "membership"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "membership_company_id_user_id_key" ON "membership"("company_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_key_key" ON "role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permission_key_key" ON "permission"("key");

-- CreateIndex
CREATE INDEX "permission_module_id_idx" ON "permission"("module_id");

-- CreateIndex
CREATE INDEX "permission_active_idx" ON "permission"("active");

-- CreateIndex
CREATE UNIQUE INDEX "role_permission_role_id_permission_id_key" ON "role_permission"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "file_asset_module_key_entity_type_entity_id_idx" ON "file_asset"("module_key", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_module_key_entity_type_entity_id_idx" ON "audit_log"("module_key", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "contact_type_idx" ON "contact"("type");

-- CreateIndex
CREATE INDEX "contact_name_idx" ON "contact"("name");

-- CreateIndex
CREATE INDEX "contact_company_id_enabled_idx" ON "contact"("company_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employee_user_profile_id_key" ON "hr_employee"("user_profile_id");

-- CreateIndex
CREATE INDEX "hr_employee_company_id_enabled_idx" ON "hr_employee"("company_id", "enabled");

-- CreateIndex
CREATE INDEX "hr_employee_company_id_last_name_first_name_idx" ON "hr_employee"("company_id", "last_name", "first_name");

-- CreateIndex
CREATE INDEX "hr_employee_company_id_supervisor_employee_id_idx" ON "hr_employee"("company_id", "supervisor_employee_id");

-- CreateIndex
CREATE INDEX "hr_employee_company_id_department_id_idx" ON "hr_employee"("company_id", "department_id");

-- CreateIndex
CREATE INDEX "hr_employee_company_id_job_title_id_idx" ON "hr_employee"("company_id", "job_title_id");

-- CreateIndex
CREATE INDEX "hr_department_company_id_enabled_idx" ON "hr_department"("company_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "hr_department_company_id_name_key" ON "hr_department"("company_id", "name");

-- CreateIndex
CREATE INDEX "hr_job_title_company_id_enabled_idx" ON "hr_job_title"("company_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "hr_job_title_company_id_name_key" ON "hr_job_title"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "instance_config_key_key" ON "instance_config"("key");

-- CreateIndex
CREATE UNIQUE INDEX "branding_config_company_id_key" ON "branding_config"("company_id");

-- CreateIndex
CREATE INDEX "notification_user_id_read_at_idx" ON "notification"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notification_created_at_idx" ON "notification"("created_at");

-- CreateIndex
CREATE INDEX "user_preference_user_id_idx" ON "user_preference"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_preference_user_id_key_key" ON "user_preference"("user_id", "key");

-- AddForeignKey
ALTER TABLE "module_dependency" ADD CONSTRAINT "module_dependency_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "atlas_module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_dependency" ADD CONSTRAINT "module_dependency_dependency_id_fkey" FOREIGN KEY ("dependency_id") REFERENCES "atlas_module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprint" ADD CONSTRAINT "blueprint_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "atlas_module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_field" ADD CONSTRAINT "atlas_field_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "atlas_model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atlas_view" ADD CONSTRAINT "atlas_view_model_name_fkey" FOREIGN KEY ("model_name") REFERENCES "atlas_model"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_table_preference" ADD CONSTRAINT "user_table_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission" ADD CONSTRAINT "permission_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "atlas_module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee" ADD CONSTRAINT "hr_employee_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee" ADD CONSTRAINT "hr_employee_user_profile_id_fkey" FOREIGN KEY ("user_profile_id") REFERENCES "user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee" ADD CONSTRAINT "hr_employee_supervisor_employee_id_fkey" FOREIGN KEY ("supervisor_employee_id") REFERENCES "hr_employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee" ADD CONSTRAINT "hr_employee_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "hr_department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee" ADD CONSTRAINT "hr_employee_job_title_id_fkey" FOREIGN KEY ("job_title_id") REFERENCES "hr_job_title"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employee" ADD CONSTRAINT "hr_employee_profile_image_file_id_fkey" FOREIGN KEY ("profile_image_file_id") REFERENCES "file_asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_department" ADD CONSTRAINT "hr_department_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_job_title" ADD CONSTRAINT "hr_job_title_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branding_config" ADD CONSTRAINT "branding_config_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;


DO $$
DECLARE col record;
BEGIN
  FOR col IN
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'id'
      AND c.data_type = 'uuid'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT uuidv7()',
      col.table_schema, col.table_name, col.column_name
    );
  END LOOP;
END $$;
