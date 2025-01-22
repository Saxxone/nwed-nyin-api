/*
  Warnings:

  - You are about to drop the column `sound` on the `Word` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sound_metadata_id]` on the table `Word` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Word` DROP COLUMN `sound`,
    ADD COLUMN `sound_metadata_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `SoundMetadata` (
    `id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(1024) NOT NULL,
    `format` VARCHAR(50) NULL,
    `duration` INTEGER NULL,
    `bitrate` INTEGER NULL,
    `size` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `word_id` VARCHAR(191) NULL,

    UNIQUE INDEX `SoundMetadata_id_key`(`id`),
    UNIQUE INDEX `SoundMetadata_word_id_key`(`word_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Word_sound_metadata_id_key` ON `Word`(`sound_metadata_id`);

-- CreateIndex
CREATE INDEX `Word_sound_metadata_id_idx` ON `Word`(`sound_metadata_id`);

-- AddForeignKey
ALTER TABLE `SoundMetadata` ADD CONSTRAINT `SoundMetadata_word_id_fkey` FOREIGN KEY (`word_id`) REFERENCES `Word`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
