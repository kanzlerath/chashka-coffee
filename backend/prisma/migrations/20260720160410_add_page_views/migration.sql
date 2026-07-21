-- CreateEnum
CREATE TYPE "AnalyticsDevice" AS ENUM ('DESKTOP', 'TABLET', 'MOBILE');

-- CreateTable
CREATE TABLE "page_views" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "path" VARCHAR(500) NOT NULL,
    "visitor_id" UUID NOT NULL,
    "referrer" VARCHAR(1000),
    "device" "AnalyticsDevice" NOT NULL DEFAULT 'DESKTOP',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "page_views_created_at_idx" ON "page_views"("created_at");

-- CreateIndex
CREATE INDEX "page_views_path_created_at_idx" ON "page_views"("path", "created_at");

-- CreateIndex
CREATE INDEX "page_views_visitor_created_at_idx" ON "page_views"("visitor_id", "created_at");
