/*
  Warnings:

  - You are about to drop the column `bitrate` on the `WordPronunciationAudio` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `WordPronunciationAudio` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `File` DROP FOREIGN KEY `File_article_id_fkey`;

-- DropIndex
DROP INDEX `File_article_id_fkey` ON `File`;

-- AlterTable
ALTER TABLE `File` MODIFY `article_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `WordPronunciationAudio` DROP COLUMN `bitrate`,
    DROP COLUMN `duration`;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `Article`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
