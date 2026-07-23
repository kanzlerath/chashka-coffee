-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "visit_amenities" JSONB NOT NULL DEFAULT '[]';
