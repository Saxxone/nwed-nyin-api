/*
  Warnings:

  - Added the required column `contributor_id` to the `SoundMetadata` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `SoundMetadata` ADD COLUMN `contributor_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED', 'PENDING', 'APPROVED', 'REJECTED', 'UPLOADED', 'DELETED', 'SEEN') NOT NULL DEFAULT 'PENDING';

-- AddForeignKey
ALTER TABLE `SoundMetadata` ADD CONSTRAINT `SoundMetadata_contributor_id_fkey` FOREIGN KEY (`contributor_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
