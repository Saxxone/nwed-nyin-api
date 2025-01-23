/*
  Warnings:

  - You are about to alter the column `type` on the `File` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(5))`.
  - You are about to drop the column `media_id` on the `WordPronunciationAudio` table. All the data in the column will be lost.
  - You are about to drop the `Media` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `article_id` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_id` to the `WordPronunciationAudio` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Media` DROP FOREIGN KEY `Media_article_id_fkey`;

-- DropForeignKey
ALTER TABLE `WordPronunciationAudio` DROP FOREIGN KEY `WordPronunciationAudio_media_id_fkey`;

-- DropIndex
DROP INDEX `WordPronunciationAudio_media_id_fkey` ON `WordPronunciationAudio`;

-- AlterTable
ALTER TABLE `File` ADD COLUMN `alt_text` VARCHAR(191) NULL,
    ADD COLUMN `article_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `caption` VARCHAR(191) NULL,
    ADD COLUMN `credit` VARCHAR(191) NULL,
    MODIFY `type` ENUM('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT') NOT NULL;

-- AlterTable
ALTER TABLE `WordPronunciationAudio` DROP COLUMN `media_id`,
    ADD COLUMN `file_id` VARCHAR(191) NOT NULL;

-- DropTable
DROP TABLE `Media`;

-- AddForeignKey
ALTER TABLE `WordPronunciationAudio` ADD CONSTRAINT `WordPronunciationAudio_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `File`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
