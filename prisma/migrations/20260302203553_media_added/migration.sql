/*
  Warnings:

  - You are about to drop the `product_media` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "MediaCategory" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'ARCHIVE', 'OTHER');

-- DropForeignKey
ALTER TABLE "product_media" DROP CONSTRAINT "product_media_productId_fkey";

-- DropTable
DROP TABLE "product_media";

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "category" "MediaCategory" NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "title" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "aspectRatio" DOUBLE PRECISION,
    "duration" INTEGER,
    "thumbnailUrl" TEXT,
    "folder" TEXT,
    "tags" TEXT[],
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_uploaderId_createdAt_idx" ON "media"("uploaderId", "createdAt");

-- CreateIndex
CREATE INDEX "media_category_createdAt_idx" ON "media"("category", "createdAt");

-- CreateIndex
CREATE INDEX "media_isDeleted_createdAt_idx" ON "media"("isDeleted", "createdAt");

-- CreateIndex
CREATE INDEX "media_productId_idx" ON "media"("productId");

-- CreateIndex
CREATE INDEX "media_tags_idx" ON "media"("tags");

-- CreateIndex
CREATE INDEX "media_folder_idx" ON "media"("folder");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
