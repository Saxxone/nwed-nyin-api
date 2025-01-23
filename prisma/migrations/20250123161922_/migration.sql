/*
  Warnings:

  - You are about to drop the column `sound_metadata_id` on the `Word` table. All the data in the column will be lost.
  - You are about to drop the `SoundMetadata` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `SoundMetadata` DROP FOREIGN KEY `SoundMetadata_contributor_id_fkey`;

-- DropForeignKey
ALTER TABLE `SoundMetadata` DROP FOREIGN KEY `SoundMetadata_word_id_fkey`;

-- DropIndex
DROP INDEX `Word_id_key` ON `Word`;

-- DropIndex
DROP INDEX `Word_sound_metadata_id_idx` ON `Word`;

-- DropIndex
DROP INDEX `Word_sound_metadata_id_key` ON `Word`;

-- AlterTable
ALTER TABLE `Word` DROP COLUMN `sound_metadata_id`,
    ADD COLUMN `accent` VARCHAR(191) NULL,
    ADD COLUMN `dialect` VARCHAR(191) NULL,
    ADD COLUMN `language_id` VARCHAR(191) NULL,
    ALTER COLUMN `deleted_at` DROP DEFAULT;

-- DropTable
DROP TABLE `SoundMetadata`;

-- CreateTable
CREATE TABLE `WordPronunciationAudio` (
    `id` VARCHAR(191) NOT NULL,
    `format` VARCHAR(50) NULL,
    `duration` INTEGER NULL,
    `bitrate` INTEGER NULL,
    `language_id` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED', 'PENDING', 'APPROVED', 'REJECTED', 'UPLOADED', 'DELETED', 'SEEN') NOT NULL DEFAULT 'PENDING',
    `contributor_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `word_id` VARCHAR(191) NOT NULL,
    `media_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `WordPronunciationAudio_word_id_key`(`word_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Language` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Language_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Dialect` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `language_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Dialect_name_key`(`name`),
    UNIQUE INDEX `Dialect_name_language_id_key`(`name`, `language_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Word` ADD CONSTRAINT `Word_language_id_fkey` FOREIGN KEY (`language_id`) REFERENCES `Language`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WordPronunciationAudio` ADD CONSTRAINT `WordPronunciationAudio_language_id_fkey` FOREIGN KEY (`language_id`) REFERENCES `Language`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WordPronunciationAudio` ADD CONSTRAINT `WordPronunciationAudio_contributor_id_fkey` FOREIGN KEY (`contributor_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WordPronunciationAudio` ADD CONSTRAINT `WordPronunciationAudio_word_id_fkey` FOREIGN KEY (`word_id`) REFERENCES `Word`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WordPronunciationAudio` ADD CONSTRAINT `WordPronunciationAudio_media_id_fkey` FOREIGN KEY (`media_id`) REFERENCES `Media`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Dialect` ADD CONSTRAINT `Dialect_language_id_fkey` FOREIGN KEY (`language_id`) REFERENCES `Language`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
