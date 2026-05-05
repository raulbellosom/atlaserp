-- AlterTable
ALTER TABLE "HrEmployee"
ADD COLUMN "userProfileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HrEmployee_userProfileId_key" ON "HrEmployee"("userProfileId");

-- AddForeignKey
ALTER TABLE "HrEmployee"
ADD CONSTRAINT "HrEmployee_userProfileId_fkey"
FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
