/*
  Warnings:

  - You are about to drop the column `dimensions` on the `Media` table. All the data in the column will be lost.
  - You are about to drop the column `preferences` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[word_id,part_of_speech_id,meaning]` on the table `Definition` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Definition_word_id_order_key";

-- DropIndex
DROP INDEX "WordRelation_from_id_to_id_type_key";

-- AlterTable
ALTER TABLE "Article" ALTER COLUMN "deleted_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Media" DROP COLUMN "dimensions",
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "width" INTEGER;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "preferences";

-- AlterTable
ALTER TABLE "Word" ALTER COLUMN "deleted_at" SET DEFAULT now();

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_user_id_key" ON "UserPreference"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_user_id_key_key" ON "UserPreference"("user_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Definition_word_id_part_of_speech_id_meaning_key" ON "Definition"("word_id", "part_of_speech_id", "meaning");

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
