-- CreateTable
CREATE TABLE "homepage_day_sections" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "title" VARCHAR(180) NOT NULL,
    "description" VARCHAR(500),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_day_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homepage_day_parts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "section_id" UUID NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" VARCHAR(500),
    "cta_url" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homepage_day_parts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "homepage_day_sections_published_idx" ON "homepage_day_sections"("is_published");

-- CreateIndex
CREATE INDEX "homepage_day_parts_section_published_position_idx" ON "homepage_day_parts"("section_id", "is_published", "position");

-- AddForeignKey
ALTER TABLE "homepage_day_parts" ADD CONSTRAINT "homepage_day_parts_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "homepage_day_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
