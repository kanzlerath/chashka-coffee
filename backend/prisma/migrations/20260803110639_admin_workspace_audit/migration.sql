-- CreateTable
CREATE TABLE "admin_audit_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "actor_id" UUID,
    "actor_name" VARCHAR(320) NOT NULL,
    "action" VARCHAR(24) NOT NULL,
    "resource" VARCHAR(80) NOT NULL,
    "resource_id" VARCHAR(120),
    "path" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_events_created_at_idx" ON "admin_audit_events"("created_at");

-- CreateIndex
CREATE INDEX "admin_audit_events_resource_id_idx" ON "admin_audit_events"("resource", "resource_id");

-- AddForeignKey
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
