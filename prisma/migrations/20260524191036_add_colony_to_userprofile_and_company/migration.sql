-- AlterTable
ALTER TABLE "AtlasField" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AtlasModel" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AtlasModule" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AtlasView" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Blueprint" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BrandingConfig" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "colony" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Contact" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FileAsset" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinanceAccount" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinanceDocument" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinanceDocumentAccountingLink" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinanceDocumentApplication" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinanceDocumentTaxLine" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinanceFxRate" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinanceJournalEntry" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinanceJournalLine" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FinanceTaxRate" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "HrDepartment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "HrEmployee" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "HrJobTitle" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InstanceConfig" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LedgerAccount" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LedgerMovement" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Membership" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ModuleDependency" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ModuleMigration" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Permission" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Role" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RolePermission" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserPreference" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "colony" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UserTablePreference" ALTER COLUMN "id" DROP DEFAULT;
