-- CreateEnum
CREATE TYPE "OrderPaymentAttemptStatus" AS ENUM ('CREATING', 'PENDING', 'SUCCEEDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "OrderReceiptStatus" AS ENUM ('CREATING', 'PENDING', 'SUCCEEDED', 'CANCELED');

-- CreateTable
CREATE TABLE "order_payments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "order_id" UUID NOT NULL,
    "active_order_id" UUID,
    "provider_payment_id" VARCHAR(64),
    "idempotency_key" UUID NOT NULL,
    "status" "OrderPaymentAttemptStatus" NOT NULL DEFAULT 'CREATING',
    "amount_kopecks" INTEGER NOT NULL,
    "confirmation_url" TEXT,
    "receipt_registration" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_closing_receipts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "order_id" UUID NOT NULL,
    "payment_attempt_id" UUID NOT NULL,
    "provider_receipt_id" VARCHAR(64),
    "idempotency_key" UUID NOT NULL,
    "status" "OrderReceiptStatus" NOT NULL DEFAULT 'CREATING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_closing_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_payments_active_order_id_key" ON "order_payments"("active_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_payments_provider_payment_id_key" ON "order_payments"("provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_payments_idempotency_key_key" ON "order_payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "order_payments_order_created_at_idx" ON "order_payments"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_closing_receipts_order_id_key" ON "order_closing_receipts"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_closing_receipts_payment_attempt_id_key" ON "order_closing_receipts"("payment_attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_closing_receipts_provider_receipt_id_key" ON "order_closing_receipts"("provider_receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_closing_receipts_idempotency_key_key" ON "order_closing_receipts"("idempotency_key");

-- AddForeignKey
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_closing_receipts" ADD CONSTRAINT "order_closing_receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_closing_receipts" ADD CONSTRAINT "order_closing_receipts_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "order_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
