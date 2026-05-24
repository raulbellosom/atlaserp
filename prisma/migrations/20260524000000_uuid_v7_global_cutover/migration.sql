/*
  UUID v7 global cutover migration.
  Destructive by design: this reset removes existing public objects.
  Approved under reset-total migration policy.
*/
DO $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', obj.tablename);
  END LOOP;

  FOR obj IN
    SELECT matviewname
    FROM pg_matviews
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS public.%I CASCADE', obj.matviewname);
  END LOOP;

  FOR obj IN
    SELECT viewname
    FROM pg_views
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', obj.viewname);
  END LOOP;

  FOR obj IN
    SELECT sequencename
    FROM pg_sequences
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP SEQUENCE IF EXISTS public.%I CASCADE', obj.sequencename);
  END LOOP;

  FOR obj IN
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype = 'e'
  LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', obj.typname);
  END LOOP;
END $$;

-- Compatibility function:
-- On PostgreSQL versions with native pg_catalog.uuidv7(), that built-in will be used.
-- On older versions, this public.uuidv7 implementation provides equivalent UUIDv7 generation.
CREATE OR REPLACE FUNCTION public.uuidv7(ts timestamptz DEFAULT clock_timestamp()) RETURNS uuid
AS $$
 select encode(
 set_bit(
 set_bit(
 overlay(uuid_send(gen_random_uuid()) placing
 substring(int8send((extract(epoch from ts)*1000)::bigint) from 3)
 from 1 for 6),
 52, 1),
 53, 1), 'hex')::uuid;
$$ LANGUAGE sql volatile parallel safe;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ModuleKind" AS ENUM ('CORE', 'FEATURE', 'INTEGRATION', 'WEBSITE');

-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('INSTALLED', 'DISABLED', 'UNINSTALLED', 'ERROR');

-- CreateEnum
CREATE TYPE "BlueprintKind" AS ENUM ('ENTITY', 'FORM', 'TABLE', 'DASHBOARD', 'ACTION', 'RELATION', 'PERMISSION');

-- CreateEnum
CREATE TYPE "FileVisibility" AS ENUM ('PRIVATE', 'INTERNAL', 'PUBLIC');

-- CreateEnum
CREATE TYPE "FinanceDocumentDirection" AS ENUM ('AR', 'AP');

-- CreateEnum
CREATE TYPE "FinanceDocumentType" AS ENUM ('INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'ADVANCE', 'PAYMENT');

-- CreateEnum
CREATE TYPE "FinanceDocumentStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "FinanceTaxKind" AS ENUM ('TRANSFER', 'WITHHOLDING');

-- CreateEnum
CREATE TYPE "FinanceDocumentEventType" AS ENUM ('ISSUE', 'APPLY', 'REVERSE', 'VOID', 'ADJUST');

-- CreateEnum
CREATE TYPE "FinanceApplicationStatus" AS ENUM ('APPLIED', 'REVERSED');

-- CreateEnum
CREATE TYPE "LedgerMovementDirection" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerMovementStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateTable
CREATE TABLE "AtlasModule" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL,
    "kind" "ModuleKind" NOT NULL DEFAULT 'FEATURE',
    "status" "ModuleStatus" NOT NULL DEFAULT 'INSTALLED',
    "core" BOOLEAN NOT NULL DEFAULT false,
    "uninstallable" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "manifest" JSONB NOT NULL,
    "lifecycleConfig" JSONB,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtlasModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleDependency" (
    "id" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "dependencyId" UUID NOT NULL,
    "versionRange" TEXT,
    "optional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ModuleDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blueprint" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "moduleId" UUID NOT NULL,
    "kind" "BlueprintKind" NOT NULL,
    "version" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Blueprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtlasModel" (
    "id" UUID NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "pluralLabel" TEXT,
    "companyScoped" BOOLEAN NOT NULL DEFAULT true,
    "schema" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtlasModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtlasField" (
    "id" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "readonly" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" JSONB,
    "options" JSONB,
    "relation" JSONB,
    "validation" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AtlasField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AtlasView" (
    "id" UUID NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "modelName" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "schema" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtlasView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleMigration" (
    "id" UUID NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleMigration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legalName" TEXT,
    "rfc" TEXT,
    "companyType" TEXT,
    "companyTypeName" TEXT,
    "industryKey" TEXT,
    "industryName" TEXT,
    "companySize" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "street" TEXT,
    "extNumber" TEXT,
    "intNumber" TEXT,
    "postalCode" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "authUserId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "avatarFileId" UUID,
    "birthDate" TIMESTAMP(3),
    "gender" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "street" TEXT,
    "extNumber" TEXT,
    "intNumber" TEXT,
    "postalCode" TEXT,
    "bio" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTablePreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tableKey" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTablePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "moduleId" UUID,
    "moduleKey" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "visibility" "FileVisibility" NOT NULL DEFAULT 'PRIVATE',
    "moduleKey" TEXT,
    "entityType" TEXT,
    "entityId" UUID,
    "uploadedById" UUID,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "moduleKey" TEXT,
    "entityType" TEXT,
    "entityId" UUID,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" UUID NOT NULL,
    "companyId" UUID,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "taxId" TEXT,
    "notesMarkdown" TEXT,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrEmployee" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userProfileId" UUID,
    "supervisorEmployeeId" UUID,
    "departmentId" UUID,
    "jobTitleId" UUID,
    "profileImageFileId" UUID,
    "employeeCode" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "workEmail" TEXT,
    "personalEmail" TEXT,
    "phone" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "jobTitle" TEXT,
    "department" TEXT,
    "managerName" TEXT,
    "employmentType" TEXT,
    "workLocation" TEXT,
    "hireDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "notesMarkdown" TEXT,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrDepartment" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrJobTitle" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrJobTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceAccount" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "parentAccountId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "initialBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceJournalEntry" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "createdById" UUID,
    "entryNumber" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "concept" TEXT NOT NULL,
    "reference" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceJournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceJournalLine" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "contactId" UUID,
    "debit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "credit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "fxRate" DECIMAL(65,30),
    "baseAmount" DECIMAL(65,30),
    "note" TEXT,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceJournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceFxRate" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rateDate" TIMESTAMP(3) NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceFxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceDocument" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "direction" "FinanceDocumentDirection" NOT NULL,
    "docType" "FinanceDocumentType" NOT NULL,
    "status" "FinanceDocumentStatus" NOT NULL DEFAULT 'OPEN',
    "contactId" UUID,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "reference" TEXT,
    "notesMarkdown" TEXT,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "openAmount" DECIMAL(65,30) NOT NULL,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTaxRate" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FinanceTaxKind" NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "direction" "FinanceDocumentDirection",
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceTaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceDocumentTaxLine" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "taxRateId" UUID,
    "taxKey" TEXT NOT NULL,
    "taxName" TEXT NOT NULL,
    "kind" "FinanceTaxKind" NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "baseAmount" DECIMAL(65,30) NOT NULL,
    "taxAmount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceDocumentTaxLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceDocumentApplication" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "sourceDocumentId" UUID NOT NULL,
    "targetDocumentId" UUID NOT NULL,
    "appliedAmount" DECIMAL(65,30) NOT NULL,
    "status" "FinanceApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "effectiveFxRate" DECIMAL(65,30),
    "sourceAmount" DECIMAL(65,30),
    "targetAmount" DECIMAL(65,30),
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedById" UUID,
    "reversalReason" TEXT,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceDocumentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceDocumentAccountingLink" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "journalEntryId" UUID NOT NULL,
    "eventType" "FinanceDocumentEventType" NOT NULL,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceDocumentAccountingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstanceConfig" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandingConfig" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "logoFileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companyId" UUID,
    "kind" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'otro',
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "initialBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdById" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerMovement" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "direction" "LedgerMovementDirection" NOT NULL,
    "movementType" TEXT,
    "number" TEXT,
    "name" TEXT,
    "reference" TEXT,
    "concept" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "balanceAfter" DECIMAL(65,30) NOT NULL,
    "status" "LedgerMovementStatus" NOT NULL DEFAULT 'ACTIVE',
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" UUID,
    "createdById" UUID,
    "metadata" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AtlasModule_key_key" ON "AtlasModule"("key");

-- CreateIndex
CREATE INDEX "AtlasModule_status_enabled_idx" ON "AtlasModule"("status", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleDependency_moduleId_dependencyId_key" ON "ModuleDependency"("moduleId", "dependencyId");

-- CreateIndex
CREATE UNIQUE INDEX "Blueprint_key_key" ON "Blueprint"("key");

-- CreateIndex
CREATE INDEX "Blueprint_moduleId_idx" ON "Blueprint"("moduleId");

-- CreateIndex
CREATE INDEX "Blueprint_enabled_idx" ON "Blueprint"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasModel_name_key" ON "AtlasModel"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasModel_tableName_key" ON "AtlasModel"("tableName");

-- CreateIndex
CREATE INDEX "AtlasModel_moduleKey_idx" ON "AtlasModel"("moduleKey");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasField_modelId_name_key" ON "AtlasField"("modelId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AtlasView_key_key" ON "AtlasView"("key");

-- CreateIndex
CREATE INDEX "AtlasView_moduleKey_idx" ON "AtlasView"("moduleKey");

-- CreateIndex
CREATE INDEX "AtlasView_modelName_idx" ON "AtlasView"("modelName");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleMigration_moduleKey_filename_key" ON "ModuleMigration"("moduleKey", "filename");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_authUserId_key" ON "UserProfile"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- CreateIndex
CREATE INDEX "UserTablePreference_userId_idx" ON "UserTablePreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTablePreference_userId_tableKey_key" ON "UserTablePreference"("userId", "tableKey");

-- CreateIndex
CREATE INDEX "Membership_userId_enabled_idx" ON "Membership"("userId", "enabled");

-- CreateIndex
CREATE INDEX "Membership_companyId_idx" ON "Membership"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_companyId_userId_key" ON "Membership"("companyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Permission_moduleId_idx" ON "Permission"("moduleId");

-- CreateIndex
CREATE INDEX "Permission_active_idx" ON "Permission"("active");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "FileAsset_moduleKey_entityType_entityId_idx" ON "FileAsset"("moduleKey", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_moduleKey_entityType_entityId_idx" ON "AuditLog"("moduleKey", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Contact_type_idx" ON "Contact"("type");

-- CreateIndex
CREATE INDEX "Contact_name_idx" ON "Contact"("name");

-- CreateIndex
CREATE INDEX "Contact_companyId_enabled_idx" ON "Contact"("companyId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "HrEmployee_userProfileId_key" ON "HrEmployee"("userProfileId");

-- CreateIndex
CREATE INDEX "HrEmployee_companyId_enabled_idx" ON "HrEmployee"("companyId", "enabled");

-- CreateIndex
CREATE INDEX "HrEmployee_companyId_lastName_firstName_idx" ON "HrEmployee"("companyId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "HrEmployee_companyId_supervisorEmployeeId_idx" ON "HrEmployee"("companyId", "supervisorEmployeeId");

-- CreateIndex
CREATE INDEX "HrEmployee_companyId_departmentId_idx" ON "HrEmployee"("companyId", "departmentId");

-- CreateIndex
CREATE INDEX "HrEmployee_companyId_jobTitleId_idx" ON "HrEmployee"("companyId", "jobTitleId");

-- CreateIndex
CREATE INDEX "HrDepartment_companyId_enabled_idx" ON "HrDepartment"("companyId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "HrDepartment_companyId_name_key" ON "HrDepartment"("companyId", "name");

-- CreateIndex
CREATE INDEX "HrJobTitle_companyId_enabled_idx" ON "HrJobTitle"("companyId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "HrJobTitle_companyId_name_key" ON "HrJobTitle"("companyId", "name");

-- CreateIndex
CREATE INDEX "FinanceAccount_companyId_enabled_idx" ON "FinanceAccount"("companyId", "enabled");

-- CreateIndex
CREATE INDEX "FinanceAccount_companyId_type_idx" ON "FinanceAccount"("companyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceAccount_companyId_code_key" ON "FinanceAccount"("companyId", "code");

-- CreateIndex
CREATE INDEX "FinanceJournalEntry_companyId_occurredAt_idx" ON "FinanceJournalEntry"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "FinanceJournalEntry_enabled_occurredAt_idx" ON "FinanceJournalEntry"("enabled", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceJournalEntry_companyId_entryNumber_key" ON "FinanceJournalEntry"("companyId", "entryNumber");

-- CreateIndex
CREATE INDEX "FinanceJournalLine_entryId_idx" ON "FinanceJournalLine"("entryId");

-- CreateIndex
CREATE INDEX "FinanceJournalLine_accountId_idx" ON "FinanceJournalLine"("accountId");

-- CreateIndex
CREATE INDEX "FinanceJournalLine_contactId_idx" ON "FinanceJournalLine"("contactId");

-- CreateIndex
CREATE INDEX "FinanceFxRate_companyId_rateDate_idx" ON "FinanceFxRate"("companyId", "rateDate");

-- CreateIndex
CREATE INDEX "FinanceFxRate_companyId_baseCurrency_quoteCurrency_idx" ON "FinanceFxRate"("companyId", "baseCurrency", "quoteCurrency");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceFxRate_companyId_baseCurrency_quoteCurrency_rateDate_key" ON "FinanceFxRate"("companyId", "baseCurrency", "quoteCurrency", "rateDate");

-- CreateIndex
CREATE INDEX "FinanceDocument_companyId_direction_status_idx" ON "FinanceDocument"("companyId", "direction", "status");

-- CreateIndex
CREATE INDEX "FinanceDocument_companyId_issueDate_idx" ON "FinanceDocument"("companyId", "issueDate");

-- CreateIndex
CREATE INDEX "FinanceDocument_companyId_dueDate_idx" ON "FinanceDocument"("companyId", "dueDate");

-- CreateIndex
CREATE INDEX "FinanceDocument_contactId_idx" ON "FinanceDocument"("contactId");

-- CreateIndex
CREATE INDEX "FinanceTaxRate_companyId_kind_idx" ON "FinanceTaxRate"("companyId", "kind");

-- CreateIndex
CREATE INDEX "FinanceTaxRate_companyId_direction_idx" ON "FinanceTaxRate"("companyId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTaxRate_companyId_key_key" ON "FinanceTaxRate"("companyId", "key");

-- CreateIndex
CREATE INDEX "FinanceDocumentTaxLine_companyId_documentId_idx" ON "FinanceDocumentTaxLine"("companyId", "documentId");

-- CreateIndex
CREATE INDEX "FinanceDocumentTaxLine_companyId_kind_idx" ON "FinanceDocumentTaxLine"("companyId", "kind");

-- CreateIndex
CREATE INDEX "FinanceDocumentApplication_companyId_appliedAt_idx" ON "FinanceDocumentApplication"("companyId", "appliedAt");

-- CreateIndex
CREATE INDEX "FinanceDocumentApplication_companyId_sourceDocumentId_idx" ON "FinanceDocumentApplication"("companyId", "sourceDocumentId");

-- CreateIndex
CREATE INDEX "FinanceDocumentApplication_companyId_targetDocumentId_idx" ON "FinanceDocumentApplication"("companyId", "targetDocumentId");

-- CreateIndex
CREATE INDEX "FinanceDocumentApplication_companyId_status_idx" ON "FinanceDocumentApplication"("companyId", "status");

-- CreateIndex
CREATE INDEX "FinanceDocumentAccountingLink_companyId_documentId_idx" ON "FinanceDocumentAccountingLink"("companyId", "documentId");

-- CreateIndex
CREATE INDEX "FinanceDocumentAccountingLink_companyId_journalEntryId_idx" ON "FinanceDocumentAccountingLink"("companyId", "journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceDocumentAccountingLink_documentId_journalEntryId_eve_key" ON "FinanceDocumentAccountingLink"("documentId", "journalEntryId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "InstanceConfig_key_key" ON "InstanceConfig"("key");

-- CreateIndex
CREATE UNIQUE INDEX "BrandingConfig_companyId_key" ON "BrandingConfig"("companyId");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key_key" ON "UserPreference"("userId", "key");

-- CreateIndex
CREATE INDEX "LedgerAccount_companyId_enabled_idx" ON "LedgerAccount"("companyId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_companyId_name_key" ON "LedgerAccount"("companyId", "name");

-- CreateIndex
CREATE INDEX "LedgerMovement_companyId_occurredAt_idx" ON "LedgerMovement"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "LedgerMovement_accountId_occurredAt_idx" ON "LedgerMovement"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "LedgerMovement_accountId_status_idx" ON "LedgerMovement"("accountId", "status");

-- CreateIndex
CREATE INDEX "LedgerMovement_companyId_status_idx" ON "LedgerMovement"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerMovement_accountId_sequenceNumber_key" ON "LedgerMovement"("accountId", "sequenceNumber");

-- AddForeignKey
ALTER TABLE "ModuleDependency" ADD CONSTRAINT "ModuleDependency_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "AtlasModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleDependency" ADD CONSTRAINT "ModuleDependency_dependencyId_fkey" FOREIGN KEY ("dependencyId") REFERENCES "AtlasModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Blueprint" ADD CONSTRAINT "Blueprint_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "AtlasModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtlasField" ADD CONSTRAINT "AtlasField_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "AtlasModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtlasView" ADD CONSTRAINT "AtlasView_modelName_fkey" FOREIGN KEY ("modelName") REFERENCES "AtlasModel"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTablePreference" ADD CONSTRAINT "UserTablePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "AtlasModule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrEmployee" ADD CONSTRAINT "HrEmployee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrEmployee" ADD CONSTRAINT "HrEmployee_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrEmployee" ADD CONSTRAINT "HrEmployee_supervisorEmployeeId_fkey" FOREIGN KEY ("supervisorEmployeeId") REFERENCES "HrEmployee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrEmployee" ADD CONSTRAINT "HrEmployee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "HrDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrEmployee" ADD CONSTRAINT "HrEmployee_jobTitleId_fkey" FOREIGN KEY ("jobTitleId") REFERENCES "HrJobTitle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrEmployee" ADD CONSTRAINT "HrEmployee_profileImageFileId_fkey" FOREIGN KEY ("profileImageFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrDepartment" ADD CONSTRAINT "HrDepartment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrJobTitle" ADD CONSTRAINT "HrJobTitle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAccount" ADD CONSTRAINT "FinanceAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceAccount" ADD CONSTRAINT "FinanceAccount_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalEntry" ADD CONSTRAINT "FinanceJournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalLine" ADD CONSTRAINT "FinanceJournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinanceJournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalLine" ADD CONSTRAINT "FinanceJournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceJournalLine" ADD CONSTRAINT "FinanceJournalLine_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceFxRate" ADD CONSTRAINT "FinanceFxRate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocument" ADD CONSTRAINT "FinanceDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocument" ADD CONSTRAINT "FinanceDocument_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTaxRate" ADD CONSTRAINT "FinanceTaxRate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentTaxLine" ADD CONSTRAINT "FinanceDocumentTaxLine_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentTaxLine" ADD CONSTRAINT "FinanceDocumentTaxLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FinanceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentTaxLine" ADD CONSTRAINT "FinanceDocumentTaxLine_taxRateId_fkey" FOREIGN KEY ("taxRateId") REFERENCES "FinanceTaxRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentApplication" ADD CONSTRAINT "FinanceDocumentApplication_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentApplication" ADD CONSTRAINT "FinanceDocumentApplication_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "FinanceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentApplication" ADD CONSTRAINT "FinanceDocumentApplication_targetDocumentId_fkey" FOREIGN KEY ("targetDocumentId") REFERENCES "FinanceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentApplication" ADD CONSTRAINT "FinanceDocumentApplication_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentAccountingLink" ADD CONSTRAINT "FinanceDocumentAccountingLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentAccountingLink" ADD CONSTRAINT "FinanceDocumentAccountingLink_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "FinanceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceDocumentAccountingLink" ADD CONSTRAINT "FinanceDocumentAccountingLink_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "FinanceJournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandingConfig" ADD CONSTRAINT "BrandingConfig_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerMovement" ADD CONSTRAINT "LedgerMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerMovement" ADD CONSTRAINT "LedgerMovement_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ensure DB-side defaults for all primary UUID id columns.
DO $$
DECLARE col RECORD;
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


