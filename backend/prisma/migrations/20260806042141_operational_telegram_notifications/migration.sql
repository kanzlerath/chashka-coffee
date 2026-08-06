-- CreateEnum
CREATE TYPE "OperationalNotificationEvent" AS ENUM ('COFFEE_ORDER', 'CAKE_REQUEST', 'JOB_APPLICATION');

-- AlterEnum
ALTER TYPE "LeadType" ADD VALUE 'CAKE';

-- CreateTable
CREATE TABLE "telegram_recipients" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" VARCHAR(120) NOT NULL,
    "chat_id" VARCHAR(24) NOT NULL,
    "username" VARCHAR(64),
    "event_types" "OperationalNotificationEvent"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sent_at" TIMESTAMP(3),
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_recipients_chat_id_key" ON "telegram_recipients"("chat_id");

-- CreateIndex
CREATE INDEX "telegram_recipients_active_idx" ON "telegram_recipients"("is_active");
