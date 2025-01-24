-- DropIndex
DROP INDEX `Definition_part_of_speech_id_fkey` ON `Definition`;

-- DropIndex
DROP INDEX `Definition_word_id_fkey` ON `Definition`;

-- DropIndex
DROP INDEX `Dialect_language_id_fkey` ON `Dialect`;

-- DropIndex
DROP INDEX `File_article_id_fkey` ON `File`;

-- DropIndex
DROP INDEX `File_owner_id_fkey` ON `File`;

-- DropIndex
DROP INDEX `Word_language_id_fkey` ON `Word`;

-- DropIndex
DROP INDEX `WordPronunciationAudio_contributor_id_fkey` ON `WordPronunciationAudio`;

-- DropIndex
DROP INDEX `WordPronunciationAudio_file_id_fkey` ON `WordPronunciationAudio`;

-- DropIndex
DROP INDEX `WordPronunciationAudio_language_id_fkey` ON `WordPronunciationAudio`;

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
