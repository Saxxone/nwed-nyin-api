/*
  Warnings:

  - A unique constraint covering the columns `[word_id,order]` on the table `Definition` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `type` on the `Media` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ReferenceType" AS ENUM ('BOOK', 'ARTICLE', 'WEBSITE', 'JOURNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('VARIANT', 'DERIVED', 'COMPOUND', 'ROOT');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "created_by" TEXT,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "updated_by" TEXT;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "alt_text" TEXT,
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "size" INTEGER,
DROP COLUMN "type",
ADD COLUMN     "type" "MediaType" NOT NULL;

-- AlterTable
ALTER TABLE "PartOfSpeech" ALTER COLUMN "name" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Reference" ADD COLUMN     "authors" TEXT,
ADD COLUMN     "doi" TEXT,
ADD COLUMN     "isbn" TEXT,
ADD COLUMN     "publisher" TEXT,
ADD COLUMN     "type" "ReferenceType" NOT NULL DEFAULT 'WEBSITE',
ADD COLUMN     "year" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_login" TIMESTAMP(3),
ADD COLUMN     "preferences" JSONB,
ADD COLUMN     "two_factor_auth" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verified_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Word" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ALTER COLUMN "term" SET DATA TYPE TEXT,
ALTER COLUMN "pronunciation" SET DATA TYPE TEXT;

-- CreateTable
CREATE TABLE "ArticleVersion" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "ArticleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleMetadata" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "keywords" TEXT[],
    "language" TEXT NOT NULL DEFAULT 'en',
    "read_time" INTEGER,
    "complexity" TEXT,

    CONSTRAINT "ArticleMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordRelation" (
    "id" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "type" "RelationType" NOT NULL,

    CONSTRAINT "WordRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleVersion_article_id_idx" ON "ArticleVersion"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleVersion_article_id_version_key" ON "ArticleVersion"("article_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleMetadata_article_id_key" ON "ArticleMetadata"("article_id");

-- CreateIndex
CREATE INDEX "WordRelation_from_id_idx" ON "WordRelation"("from_id");

-- CreateIndex
CREATE INDEX "WordRelation_to_id_idx" ON "WordRelation"("to_id");

-- CreateIndex
CREATE UNIQUE INDEX "WordRelation_from_id_to_id_type_key" ON "WordRelation"("from_id", "to_id", "type");

-- CreateIndex
CREATE INDEX "Antonym_definition_id_idx" ON "Antonym"("definition_id");

-- CreateIndex
CREATE INDEX "Article_created_by_idx" ON "Article"("created_by");

-- CreateIndex
CREATE INDEX "Article_status_created_at_idx" ON "Article"("status", "created_at");

-- CreateIndex
CREATE INDEX "Definition_word_id_idx" ON "Definition"("word_id");

-- CreateIndex
CREATE INDEX "Definition_part_of_speech_id_idx" ON "Definition"("part_of_speech_id");

-- CreateIndex
CREATE UNIQUE INDEX "Definition_word_id_order_key" ON "Definition"("word_id", "order");

-- CreateIndex
CREATE INDEX "Example_definition_id_idx" ON "Example"("definition_id");

-- CreateIndex
CREATE INDEX "Media_article_id_idx" ON "Media"("article_id");

-- CreateIndex
CREATE INDEX "Reference_article_id_idx" ON "Reference"("article_id");

-- CreateIndex
CREATE INDEX "Section_article_id_idx" ON "Section"("article_id");

-- CreateIndex
CREATE INDEX "Synonym_definition_id_idx" ON "Synonym"("definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Word_term_idx" ON "Word"("term");

-- AddForeignKey
ALTER TABLE "ArticleVersion" ADD CONSTRAINT "ArticleVersion_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleMetadata" ADD CONSTRAINT "ArticleMetadata_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordRelation" ADD CONSTRAINT "WordRelation_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "Word"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordRelation" ADD CONSTRAINT "WordRelation_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "Word"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
