-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "gallery_urls" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "menu_pdf_url" TEXT;
