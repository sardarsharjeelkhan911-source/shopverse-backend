-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");