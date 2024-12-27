/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Article` table. All the data in the column will be lost.
  - You are about to drop the column `articleId` on the `Media` table. All the data in the column will be lost.
  - You are about to drop the column `accessDate` on the `Reference` table. All the data in the column will be lost.
  - You are about to drop the column `articleId` on the `Reference` table. All the data in the column will be lost.
  - You are about to drop the column `articleId` on the `Section` table. All the data in the column will be lost.
  - You are about to drop the `_ArticleContributors` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_RelatedArticles` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updated_at` to the `Article` table without a default value. This is not possible if the table is not empty.
  - Added the required column `article_id` to the `Media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `access_date` to the `Reference` table without a default value. This is not possible if the table is not empty.
  - Added the required column `article_id` to the `Reference` table without a default value. This is not possible if the table is not empty.
  - Added the required column `article_id` to the `Section` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Media" DROP CONSTRAINT "Media_articleId_fkey";

-- DropForeignKey
ALTER TABLE "Reference" DROP CONSTRAINT "Reference_articleId_fkey";

-- DropForeignKey
ALTER TABLE "Section" DROP CONSTRAINT "Section_articleId_fkey";

-- DropForeignKey
ALTER TABLE "_ArticleContributors" DROP CONSTRAINT "_ArticleContributors_A_fkey";

-- DropForeignKey
ALTER TABLE "_ArticleContributors" DROP CONSTRAINT "_ArticleContributors_B_fkey";

-- DropForeignKey
ALTER TABLE "_RelatedArticles" DROP CONSTRAINT "_RelatedArticles_A_fkey";

-- DropForeignKey
ALTER TABLE "_RelatedArticles" DROP CONSTRAINT "_RelatedArticles_B_fkey";

-- AlterTable
ALTER TABLE "Article" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Media" DROP COLUMN "articleId",
ADD COLUMN     "article_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Reference" DROP COLUMN "accessDate",
DROP COLUMN "articleId",
ADD COLUMN     "access_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "article_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Section" DROP COLUMN "articleId",
ADD COLUMN     "article_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "_ArticleContributors";

-- DropTable
DROP TABLE "_RelatedArticles";

-- CreateTable
CREATE TABLE "Word" (
    "id" TEXT NOT NULL,
    "term" VARCHAR(255) NOT NULL,
    "pronunciation" VARCHAR(255),
    "etymology" TEXT,

    CONSTRAINT "Word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Definition" (
    "id" TEXT NOT NULL,
    "word_id" TEXT NOT NULL,
    "part_of_speech_id" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "order" INTEGER,

    CONSTRAINT "Definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartOfSpeech" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "PartOfSpeech_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Example" (
    "id" TEXT NOT NULL,
    "word_id" TEXT NOT NULL,
    "sentence" TEXT NOT NULL,

    CONSTRAINT "Example_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Synonym" (
    "id" TEXT NOT NULL,
    "word_id" TEXT NOT NULL,
    "synonym" VARCHAR(255) NOT NULL,

    CONSTRAINT "Synonym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Antonym" (
    "id" TEXT NOT NULL,
    "word_id" TEXT NOT NULL,
    "antonym" VARCHAR(255) NOT NULL,

    CONSTRAINT "Antonym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_article_contributors" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_article_contributors_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_related_articles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_related_articles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Word_term_key" ON "Word"("term");

-- CreateIndex
CREATE UNIQUE INDEX "PartOfSpeech_name_key" ON "PartOfSpeech"("name");

-- CreateIndex
CREATE INDEX "_article_contributors_B_index" ON "_article_contributors"("B");

-- CreateIndex
CREATE INDEX "_related_articles_B_index" ON "_related_articles"("B");

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Definition" ADD CONSTRAINT "Definition_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "Word"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Definition" ADD CONSTRAINT "Definition_part_of_speech_id_fkey" FOREIGN KEY ("part_of_speech_id") REFERENCES "PartOfSpeech"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Example" ADD CONSTRAINT "Example_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "Word"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Synonym" ADD CONSTRAINT "Synonym_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "Word"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Antonym" ADD CONSTRAINT "Antonym_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "Word"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_article_contributors" ADD CONSTRAINT "_article_contributors_A_fkey" FOREIGN KEY ("A") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_article_contributors" ADD CONSTRAINT "_article_contributors_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_related_articles" ADD CONSTRAINT "_related_articles_A_fkey" FOREIGN KEY ("A") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_related_articles" ADD CONSTRAINT "_related_articles_B_fkey" FOREIGN KEY ("B") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
