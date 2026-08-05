-- CreateEnum
CREATE TYPE "PushProvider" AS ENUM ('WEB_PUSH', 'EXPO');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('WEB', 'IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "NotificationCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "customer_push_subscriptions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "customer_id" UUID NOT NULL,
    "provider" "PushProvider" NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT,
    "auth_secret" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_campaigns" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "created_by_id" UUID,
    "name" VARCHAR(180) NOT NULL,
    "channel" "CommunicationChannel" NOT NULL DEFAULT 'PUSH',
    "status" "NotificationCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audience" JSONB NOT NULL DEFAULT '{}',
    "title" VARCHAR(120) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "deeplink" VARCHAR(500),
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "campaign_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "push_subscription_id" UUID,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" VARCHAR(240),
    "error_code" VARCHAR(120),
    "error_message" VARCHAR(500),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_push_subscriptions_endpoint_key" ON "customer_push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "customer_push_subscriptions_customer_active_idx" ON "customer_push_subscriptions"("customer_id", "is_active");

-- CreateIndex
CREATE INDEX "notification_campaigns_status_scheduled_idx" ON "notification_campaigns"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_campaign_status_idx" ON "notification_deliveries"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "notification_deliveries_customer_created_idx" ON "notification_deliveries"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_subscription_idx" ON "notification_deliveries"("push_subscription_id");

-- AddForeignKey
ALTER TABLE "customer_push_subscriptions" ADD CONSTRAINT "customer_push_subscriptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "notification_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_push_subscription_id_fkey" FOREIGN KEY ("push_subscription_id") REFERENCES "customer_push_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
