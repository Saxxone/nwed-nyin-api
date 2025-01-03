/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `Word` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `Word_term_alt_spelling_idx` ON `Word`;

-- CreateIndex
CREATE UNIQUE INDEX `Word_id_key` ON `Word`(`id`);
