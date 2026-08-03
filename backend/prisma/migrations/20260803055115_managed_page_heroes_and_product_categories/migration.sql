-- AlterTable
ALTER TABLE "managed_pages" ADD COLUMN     "coffee_tastes" JSONB,
ADD COLUMN     "hero_description" VARCHAR(500),
ADD COLUMN     "hero_image_url" TEXT,
ADD COLUMN     "hero_title" VARCHAR(180);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "category" VARCHAR(120);
