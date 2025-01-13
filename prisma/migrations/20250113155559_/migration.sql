/*
  Warnings:

  - You are about to drop the column `createdAt` on the `AuthToken` table. All the data in the column will be lost.
  - You are about to drop the column `expiresAt` on the `AuthToken` table. All the data in the column will be lost.
  - You are about to drop the column `isRefreshToken` on the `AuthToken` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `AuthToken` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `AuthToken` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `File` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `File` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token_hash]` on the table `AuthToken` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,is_refresh_token]` on the table `AuthToken` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `expires_at` to the `AuthToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `token_hash` to the `AuthToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `AuthToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `AuthToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `owner_id` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `AuthToken` DROP FOREIGN KEY `AuthToken_userId_fkey`;

-- DropForeignKey
ALTER TABLE `File` DROP FOREIGN KEY `File_ownerId_fkey`;

-- DropIndex
DROP INDEX `AuthToken_token_key` ON `AuthToken`;

-- DropIndex
DROP INDEX `AuthToken_userId_isRefreshToken_key` ON `AuthToken`;

-- DropIndex
DROP INDEX `File_ownerId_fkey` ON `File`;

-- AlterTable
ALTER TABLE `AuthToken` DROP COLUMN `createdAt`,
    DROP COLUMN `expiresAt`,
    DROP COLUMN `isRefreshToken`,
    DROP COLUMN `updatedAt`,
    DROP COLUMN `userId`,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `expires_at` DATETIME(3) NOT NULL,
    ADD COLUMN `is_refresh_token` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `token_hash` VARCHAR(191) NOT NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL,
    ADD COLUMN `user_id` VARCHAR(191) NOT NULL,
    MODIFY `token` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `File` DROP COLUMN `createdAt`,
    DROP COLUMN `deletedAt`,
    DROP COLUMN `ownerId`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `owner_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `AuthToken_token_hash_key` ON `AuthToken`(`token_hash`);

-- CreateIndex
CREATE UNIQUE INDEX `AuthToken_user_id_is_refresh_token_key` ON `AuthToken`(`user_id`, `is_refresh_token`);

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthToken` ADD CONSTRAINT `AuthToken_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
