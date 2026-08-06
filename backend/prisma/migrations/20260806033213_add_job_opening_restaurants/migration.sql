-- AlterTable
ALTER TABLE "job_openings" ADD COLUMN     "restaurant_id" UUID;

-- CreateIndex
CREATE INDEX "job_openings_restaurant_position_idx" ON "job_openings"("restaurant_id", "position");

-- AddForeignKey
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
