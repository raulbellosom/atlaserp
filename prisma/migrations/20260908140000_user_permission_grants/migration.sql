-- Additive per-user permission grants (ALLOW-only). Effective permissions for a
-- user = (role permissions) UNION (these grants). Never subtracts. Scoped per
-- company like membership.
-- Spec: docs/superpowers/specs/2026-09-08-per-user-permission-grants.md

-- CreateTable
CREATE TABLE "user_permission_grant" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_permission_grant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_permission_grant_user_id_company_id_idx" ON "user_permission_grant"("user_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_grant_user_id_company_id_permission_id_key" ON "user_permission_grant"("user_id", "company_id", "permission_id");

-- AddForeignKey
ALTER TABLE "user_permission_grant" ADD CONSTRAINT "user_permission_grant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grant" ADD CONSTRAINT "user_permission_grant_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grant" ADD CONSTRAINT "user_permission_grant_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grant" ADD CONSTRAINT "user_permission_grant_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Self-hosted Supabase: keep the privileged-API-only posture used by other
-- Atlas tables (no direct anon/authenticated access).
ALTER TABLE "user_permission_grant" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "user_permission_grant" FROM anon, authenticated;
