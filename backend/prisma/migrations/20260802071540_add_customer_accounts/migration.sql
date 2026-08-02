-- CreateTable
CREATE TABLE "customer_accounts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "premium_bonus_client_id" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_sessions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "customer_id" UUID NOT NULL,
    "session_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "user_agent" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_login_challenges" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "phone" VARCHAR(20) NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_login_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_accounts_premium_bonus_client_id_key" ON "customer_accounts"("premium_bonus_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_accounts_phone_key" ON "customer_accounts"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "customer_sessions_token_hash_key" ON "customer_sessions"("session_token_hash");

-- CreateIndex
CREATE INDEX "customer_sessions_customer_id_idx" ON "customer_sessions"("customer_id");

-- CreateIndex
CREATE INDEX "customer_sessions_expires_at_idx" ON "customer_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "customer_login_challenges_phone_sent_at_idx" ON "customer_login_challenges"("phone", "sent_at");

-- CreateIndex
CREATE INDEX "customer_login_challenges_expires_at_idx" ON "customer_login_challenges"("expires_at");

-- AddForeignKey
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
