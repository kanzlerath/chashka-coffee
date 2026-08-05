-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID', 'PREPARING', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "coffee_pickup_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "public_number" VARCHAR(32) NOT NULL,
    "access_token_hash" VARCHAR(64) NOT NULL,
    "idempotency_key" UUID NOT NULL,
    "customer_id" UUID,
    "pickup_restaurant_id" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "customer_name" VARCHAR(180) NOT NULL,
    "customer_phone" VARCHAR(20) NOT NULL,
    "customer_email" VARCHAR(320),
    "pickup_slug" VARCHAR(120) NOT NULL,
    "pickup_name" VARCHAR(180) NOT NULL,
    "pickup_city" VARCHAR(100) NOT NULL,
    "pickup_address" VARCHAR(300) NOT NULL,
    "pickup_phone" VARCHAR(40) NOT NULL,
    "pickup_opening_hours_label" VARCHAR(180) NOT NULL,
    "item_count" INTEGER NOT NULL,
    "total_kopecks" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "order_id" UUID NOT NULL,
    "variant_id" UUID,
    "product_name" VARCHAR(180) NOT NULL,
    "variant_label" VARCHAR(80) NOT NULL,
    "image_url" TEXT,
    "unit_price_kopecks" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "total_kopecks" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_public_number_key" ON "orders"("public_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_access_token_hash_key" ON "orders"("access_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "orders_customer_created_at_idx" ON "orders"("customer_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_pickup_status_created_at_idx" ON "orders"("pickup_restaurant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "order_items_order_position_idx" ON "order_items"("order_id", "position");

-- CreateIndex
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_pickup_restaurant_id_fkey" FOREIGN KEY ("pickup_restaurant_id") REFERENCES "restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
