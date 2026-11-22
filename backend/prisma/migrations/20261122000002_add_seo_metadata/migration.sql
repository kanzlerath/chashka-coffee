CREATE TABLE "seo_metadata" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "key" VARCHAR(160) NOT NULL,
  "path" VARCHAR(300) NOT NULL,
  "label" VARCHAR(180) NOT NULL,
  "title" VARCHAR(180),
  "description" VARCHAR(320),
  "image_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "seo_metadata_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "seo_metadata_key_key" ON "seo_metadata"("key");
CREATE UNIQUE INDEX "seo_metadata_path_key" ON "seo_metadata"("path");
