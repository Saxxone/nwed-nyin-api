/*
  Warnings:

  - The `authors` column on the `Reference` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "Article" ALTER COLUMN "deleted_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Reference" DROP COLUMN "authors",
ADD COLUMN     "authors" JSONB;

-- AlterTable
ALTER TABLE "Word" ALTER COLUMN "deleted_at" SET DEFAULT now();
