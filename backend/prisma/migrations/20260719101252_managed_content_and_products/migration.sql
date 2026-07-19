-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('COFFEE', 'CAKE');

-- CreateEnum
CREATE TYPE "ManagedPageKey" AS ENUM ('HOME', 'COFFEE', 'RESTAURANTS', 'DELIVERY', 'APP', 'LOYALTY', 'CERTIFICATES', 'BAKERY', 'FRANCHISE', 'JOBS', 'CONTACTS', 'ABOUT', 'BANQUETS', 'PROMOTIONS');

-- AlterEnum
ALTER TYPE "LeadType" ADD VALUE 'EVENT_REGISTRATION';

-- AlterTable
ALTER TABLE "content_entries" ADD COLUMN     "blocks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "price_kopecks" INTEGER,
ADD COLUMN     "registration_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "managed_pages" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "key" "ManagedPageKey" NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "managed_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "type" "ProductType" NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "subtitle" VARCHAR(180),
    "description" TEXT,
    "ingredients" TEXT,
    "origin" VARCHAR(180),
    "roast_level" VARCHAR(80),
    "tasting_notes" JSONB NOT NULL DEFAULT '[]',
    "image_url" TEXT,
    "gallery_urls" JSONB NOT NULL DEFAULT '[]',
    "details" JSONB NOT NULL DEFAULT '[]',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "product_id" UUID NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "weight_grams" INTEGER,
    "price_kopecks" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "managed_pages_key_key" ON "managed_pages"("key");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_type_status_position_idx" ON "products"("type", "status", "position");

-- CreateIndex
CREATE INDEX "product_variants_product_id_position_idx" ON "product_variants"("product_id", "position");

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
