-- CreateTable
CREATE TABLE "about_pages" (
    "id" TEXT NOT NULL,
    "heroTitle" TEXT NOT NULL,
    "heroSubtitle" TEXT,
    "heroImage" TEXT,
    "missionTitle" TEXT NOT NULL,
    "missionDescription" TEXT NOT NULL,
    "missionImage" TEXT,
    "visionTitle" TEXT,
    "visionDescription" TEXT,
    "values" JSONB NOT NULL DEFAULT '[]',
    "studioTitle" TEXT NOT NULL,
    "studioDescription" TEXT NOT NULL,
    "studioImages" JSONB NOT NULL DEFAULT '[]',
    "stats" JSONB NOT NULL DEFAULT '[]',
    "ctaTitle" TEXT NOT NULL,
    "ctaSubtitle" TEXT,
    "ctaButtonText" TEXT NOT NULL,
    "ctaButtonLink" TEXT NOT NULL,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "about_pages_pkey" PRIMARY KEY ("id")
);
