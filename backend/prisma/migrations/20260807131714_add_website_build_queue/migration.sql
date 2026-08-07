-- CreateEnum
CREATE TYPE "WebsiteBuildStatus" AS ENUM ('IDLE', 'QUEUED', 'BUILDING', 'FAILED');

-- CreateTable
CREATE TABLE "website_build_state" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'global',
    "requested_version" INTEGER NOT NULL DEFAULT 0,
    "completed_version" INTEGER NOT NULL DEFAULT 0,
    "status" "WebsiteBuildStatus" NOT NULL DEFAULT 'IDLE',
    "requested_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),
    "scheduled_through_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_build_state_pkey" PRIMARY KEY ("id")
);
