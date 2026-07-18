-- CreateEnum
CREATE TYPE "HomepageSlideMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "homepage_slides" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "media_type" "HomepageSlideMediaType" NOT NULL,
    "media_url" TEXT NOT NULL,
    "poster_url" TEXT,
    "eyebrow" VARCHAR(80),
    "title" VARCHAR(180) NOT NULL,
    "description" VARCHAR(500),
    "cta_label" VARCHAR(80),
    "cta_url" TEXT,
    "duration_seconds" INTEGER NOT NULL DEFAULT 7,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_slides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homepage_bestsellers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "menu_item_id" UUID NOT NULL,
    "badge" VARCHAR(40),
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_bestsellers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "homepage_slides_published_position_idx" ON "homepage_slides"("is_published", "position");

-- CreateIndex
CREATE INDEX "homepage_bestsellers_published_position_idx" ON "homepage_bestsellers"("is_published", "position");

-- CreateIndex
CREATE UNIQUE INDEX "homepage_bestsellers_menu_item_id_key" ON "homepage_bestsellers"("menu_item_id");

-- AddForeignKey
ALTER TABLE "homepage_bestsellers" ADD CONSTRAINT "homepage_bestsellers_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
