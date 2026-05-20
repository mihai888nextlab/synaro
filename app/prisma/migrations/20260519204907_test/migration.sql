/*
  Warnings:

  - The values [ACTIVE] on the enum `EnvironmentStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `emailVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `User` table. All the data in the column will be lost.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `email` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EnvironmentStatus_new" AS ENUM ('INACTIVE', 'PROVISIONING', 'RUNNING', 'STOPPED', 'ERROR');
ALTER TABLE "Project" ALTER COLUMN "environmentStatus" DROP DEFAULT;
ALTER TABLE "Project" ALTER COLUMN "environmentStatus" TYPE "EnvironmentStatus_new" USING ("environmentStatus"::text::"EnvironmentStatus_new");
ALTER TYPE "EnvironmentStatus" RENAME TO "EnvironmentStatus_old";
ALTER TYPE "EnvironmentStatus_new" RENAME TO "EnvironmentStatus";
DROP TYPE "EnvironmentStatus_old";
ALTER TABLE "Project" ALTER COLUMN "environmentStatus" SET DEFAULT 'INACTIVE';
COMMIT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerified",
DROP COLUMN "image",
DROP COLUMN "password",
ADD COLUMN     "passwordHash" TEXT,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL;
