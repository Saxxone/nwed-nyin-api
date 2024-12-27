-- AlterTable
ALTER TABLE "Article" ALTER COLUMN "deleted_at" SET DEFAULT now();

-- AlterTable
ALTER TABLE "Word" ALTER COLUMN "deleted_at" SET DEFAULT now();
