-- AlterTable
ALTER TABLE "blogs" ADD COLUMN     "category" TEXT,
ADD COLUMN     "coverImage" TEXT,
ADD COLUMN     "excerpt" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false;
