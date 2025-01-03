-- DropIndex
DROP INDEX `Word_term_idx` ON `Word`;

-- DropIndex
DROP INDEX `Word_term_key` ON `Word`;

-- CreateIndex
CREATE INDEX `Word_term_alt_spelling_idx` ON `Word`(`term`, `alt_spelling`);
