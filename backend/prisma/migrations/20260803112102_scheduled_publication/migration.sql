-- AlterEnum
ALTER TYPE "PublicationStatus" ADD VALUE 'SCHEDULED';

-- AlterTable
ALTER TABLE "content_entries" ADD COLUMN     "publish_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "job_openings" ADD COLUMN     "publish_at" TIMESTAMP(3),
ADD COLUMN     "status" "PublicationStatus";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "publish_at" TIMESTAMP(3);
