-- CreateTable
CREATE TABLE `Article` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `summary` VARCHAR(191) NOT NULL,
    `body` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,
    `updated_by` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED', 'PENDING', 'APPROVED', 'REJECTED', 'UPLOADED', 'DELETED', 'SEEN') NOT NULL DEFAULT 'DRAFT',

    UNIQUE INDEX `Article_slug_key`(`slug`),
    INDEX `Article_created_by_idx`(`created_by`),
    INDEX `Article_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Section` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `article_id` VARCHAR(191) NOT NULL,

    INDEX `Section_article_id_idx`(`article_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArticleVersion` (
    `id` VARCHAR(191) NOT NULL,
    `article_id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `content` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NOT NULL,

    INDEX `ArticleVersion_article_id_idx`(`article_id`),
    UNIQUE INDEX `ArticleVersion_article_id_version_key`(`article_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArticleMetadata` (
    `id` VARCHAR(191) NOT NULL,
    `article_id` VARCHAR(191) NOT NULL,
    `keywords` JSON NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'en',
    `read_time` INTEGER NULL,
    `complexity` VARCHAR(191) NULL,

    UNIQUE INDEX `ArticleMetadata_article_id_key`(`article_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `img` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'EDITOR', 'VIEWER') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `last_login` DATETIME(3) NULL,
    `verified_at` DATETIME(3) NULL,
    `two_factor_auth` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserPreference` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `UserPreference_user_id_key`(`user_id`),
    UNIQUE INDEX `UserPreference_user_id_key_key`(`user_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tag` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Tag_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reference` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('BOOK', 'ARTICLE', 'WEBSITE', 'JOURNAL', 'OTHER') NOT NULL DEFAULT 'WEBSITE',
    `citation` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NULL,
    `doi` VARCHAR(191) NULL,
    `isbn` VARCHAR(191) NULL,
    `authors` JSON NULL,
    `publisher` VARCHAR(191) NULL,
    `year` INTEGER NULL,
    `access_date` DATETIME(3) NOT NULL,
    `article_id` VARCHAR(191) NOT NULL,

    INDEX `Reference_article_id_idx`(`article_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Word` (
    `id` VARCHAR(191) NOT NULL,
    `term` VARCHAR(191) NOT NULL,
    `pronunciation` VARCHAR(191) NULL,
    `etymology` VARCHAR(255) NULL,
    `alt_spelling` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `language_id` VARCHAR(191) NULL,
    `dialect` VARCHAR(191) NULL,
    `accent` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WordPronunciationAudio` (
    `id` VARCHAR(191) NOT NULL,
    `format` VARCHAR(50) NULL,
    `language_id` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED', 'PENDING', 'APPROVED', 'REJECTED', 'UPLOADED', 'DELETED', 'SEEN') NOT NULL DEFAULT 'PENDING',
    `contributor_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `word_id` VARCHAR(191) NOT NULL,
    `file_id` VARCHAR(191) NOT NULL,

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

-- CreateTable
CREATE TABLE `WordRelation` (
    `id` VARCHAR(191) NOT NULL,
    `from_id` VARCHAR(191) NOT NULL,
    `to_id` VARCHAR(191) NOT NULL,
    `type` ENUM('VARIANT', 'DERIVED', 'COMPOUND', 'ROOT') NOT NULL,

    INDEX `WordRelation_from_id_idx`(`from_id`),
    INDEX `WordRelation_to_id_idx`(`to_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Definition` (
    `id` VARCHAR(191) NOT NULL,
    `word_id` VARCHAR(191) NOT NULL,
    `part_of_speech_id` VARCHAR(191) NOT NULL,
    `meaning` VARCHAR(500) NOT NULL,
    `order` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PartOfSpeech` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `PartOfSpeech_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Example` (
    `id` VARCHAR(191) NOT NULL,
    `definition_id` VARCHAR(191) NOT NULL,
    `sentence` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `Example_definition_id_idx`(`definition_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Synonym` (
    `id` VARCHAR(191) NOT NULL,
    `definition_id` VARCHAR(191) NOT NULL,
    `synonym` VARCHAR(255) NOT NULL,

    INDEX `Synonym_definition_id_idx`(`definition_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Antonym` (
    `id` VARCHAR(191) NOT NULL,
    `definition_id` VARCHAR(191) NOT NULL,
    `antonym` VARCHAR(255) NOT NULL,

    INDEX `Antonym_definition_id_idx`(`definition_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `File` (
    `id` VARCHAR(191) NOT NULL,
    `originalname` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `type` ENUM('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT') NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `path` VARCHAR(191) NOT NULL,
    `mimetype` VARCHAR(191) NOT NULL,
    `caption` VARCHAR(191) NULL,
    `credit` VARCHAR(191) NULL,
    `alt_text` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED', 'PENDING', 'APPROVED', 'REJECTED', 'UPLOADED', 'DELETED', 'SEEN') NOT NULL DEFAULT 'PENDING',
    `owner_id` VARCHAR(191) NOT NULL,
    `article_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthToken` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token` TEXT NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `is_refresh_token` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `AuthToken_token_hash_key`(`token_hash`),
    UNIQUE INDEX `AuthToken_user_id_is_refresh_token_key`(`user_id`, `is_refresh_token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_article_contributors` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_article_contributors_AB_unique`(`A`, `B`),
    INDEX `_article_contributors_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_ArticleToCategory` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_ArticleToCategory_AB_unique`(`A`, `B`),
    INDEX `_ArticleToCategory_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_ArticleToTag` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_ArticleToTag_AB_unique`(`A`, `B`),
    INDEX `_ArticleToTag_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_related_articles` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_related_articles_AB_unique`(`A`, `B`),
    INDEX `_related_articles_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_word_contributors` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_word_contributors_AB_unique`(`A`, `B`),
    INDEX `_word_contributors_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Section` ADD CONSTRAINT `Section_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArticleVersion` ADD CONSTRAINT `ArticleVersion_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArticleMetadata` ADD CONSTRAINT `ArticleMetadata_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserPreference` ADD CONSTRAINT `UserPreference_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reference` ADD CONSTRAINT `Reference_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `Article`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Word` ADD CONSTRAINT `Word_language_id_fkey` FOREIGN KEY (`language_id`) REFERENCES `Language`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WordPronunciationAudio` ADD CONSTRAINT `WordPronunciationAudio_language_id_fkey` FOREIGN KEY (`language_id`) REFERENCES `Language`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WordPronunciationAudio` ADD CONSTRAINT `WordPronunciationAudio_contributor_id_fkey` FOREIGN KEY (`contributor_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WordPronunciationAudio` ADD CONSTRAINT `WordPronunciationAudio_word_id_fkey` FOREIGN KEY (`word_id`) REFERENCES `Word`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WordPronunciationAudio` ADD CONSTRAINT `WordPronunciationAudio_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `File`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Dialect` ADD CONSTRAINT `Dialect_language_id_fkey` FOREIGN KEY (`language_id`) REFERENCES `Language`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WordRelation` ADD CONSTRAINT `WordRelation_from_id_fkey` FOREIGN KEY (`from_id`) REFERENCES `Word`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WordRelation` ADD CONSTRAINT `WordRelation_to_id_fkey` FOREIGN KEY (`to_id`) REFERENCES `Word`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Definition` ADD CONSTRAINT `Definition_word_id_fkey` FOREIGN KEY (`word_id`) REFERENCES `Word`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Definition` ADD CONSTRAINT `Definition_part_of_speech_id_fkey` FOREIGN KEY (`part_of_speech_id`) REFERENCES `PartOfSpeech`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Example` ADD CONSTRAINT `Example_definition_id_fkey` FOREIGN KEY (`definition_id`) REFERENCES `Definition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Synonym` ADD CONSTRAINT `Synonym_definition_id_fkey` FOREIGN KEY (`definition_id`) REFERENCES `Definition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Antonym` ADD CONSTRAINT `Antonym_definition_id_fkey` FOREIGN KEY (`definition_id`) REFERENCES `Definition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_article_id_fkey` FOREIGN KEY (`article_id`) REFERENCES `Article`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuthToken` ADD CONSTRAINT `AuthToken_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_article_contributors` ADD CONSTRAINT `_article_contributors_A_fkey` FOREIGN KEY (`A`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_article_contributors` ADD CONSTRAINT `_article_contributors_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ArticleToCategory` ADD CONSTRAINT `_ArticleToCategory_A_fkey` FOREIGN KEY (`A`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ArticleToCategory` ADD CONSTRAINT `_ArticleToCategory_B_fkey` FOREIGN KEY (`B`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ArticleToTag` ADD CONSTRAINT `_ArticleToTag_A_fkey` FOREIGN KEY (`A`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ArticleToTag` ADD CONSTRAINT `_ArticleToTag_B_fkey` FOREIGN KEY (`B`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_related_articles` ADD CONSTRAINT `_related_articles_A_fkey` FOREIGN KEY (`A`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_related_articles` ADD CONSTRAINT `_related_articles_B_fkey` FOREIGN KEY (`B`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_word_contributors` ADD CONSTRAINT `_word_contributors_A_fkey` FOREIGN KEY (`A`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_word_contributors` ADD CONSTRAINT `_word_contributors_B_fkey` FOREIGN KEY (`B`) REFERENCES `Word`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
