/*
  Warnings:

  - You are about to drop the column `word_id` on the `Antonym` table. All the data in the column will be lost.
  - You are about to drop the column `word_id` on the `Example` table. All the data in the column will be lost.
  - You are about to drop the column `word_id` on the `Synonym` table. All the data in the column will be lost.
  - Added the required column `definition_id` to the `Antonym` table without a default value. This is not possible if the table is not empty.
  - Added the required column `definition_id` to the `Example` table without a default value. This is not possible if the table is not empty.
  - Added the required column `definition_id` to the `Synonym` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Antonym" DROP CONSTRAINT "Antonym_word_id_fkey";

-- DropForeignKey
ALTER TABLE "Example" DROP CONSTRAINT "Example_word_id_fkey";

-- DropForeignKey
ALTER TABLE "Synonym" DROP CONSTRAINT "Synonym_word_id_fkey";

-- AlterTable
ALTER TABLE "Antonym" DROP COLUMN "word_id",
ADD COLUMN     "definition_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Example" DROP COLUMN "word_id",
ADD COLUMN     "definition_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Synonym" DROP COLUMN "word_id",
ADD COLUMN     "definition_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Example" ADD CONSTRAINT "Example_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "Definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Synonym" ADD CONSTRAINT "Synonym_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "Definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Antonym" ADD CONSTRAINT "Antonym_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "Definition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
