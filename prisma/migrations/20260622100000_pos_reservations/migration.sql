-- CreateEnum
CREATE TYPE "pos_reservation_status" AS ENUM ('CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "pos_reservation" (
    "id"               UUID NOT NULL DEFAULT uuidv7(),
    "company_id"       UUID NOT NULL,
    "outlet_id"        UUID NOT NULL,
    "table_id"         UUID,
    "guest_name"       TEXT NOT NULL,
    "guest_phone"      TEXT,
    "party_size"       INTEGER NOT NULL DEFAULT 2,
    "scheduled_at"     TIMESTAMPTZ NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 90,
    "notes"            TEXT,
    "status"           "pos_reservation_status" NOT NULL DEFAULT 'CONFIRMED',
    "order_id"         UUID,
    "created_by_id"    UUID NOT NULL,
    "created_at"       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pos_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pos_reservation_order_id_key" ON "pos_reservation"("order_id");
CREATE INDEX "pos_reservation_company_id_scheduled_at_idx" ON "pos_reservation"("company_id", "scheduled_at");
CREATE INDEX "pos_reservation_company_id_status_idx" ON "pos_reservation"("company_id", "status");
CREATE INDEX "pos_reservation_table_id_status_idx" ON "pos_reservation"("table_id", "status");

-- AddForeignKey
ALTER TABLE "pos_reservation" ADD CONSTRAINT "pos_reservation_outlet_id_fkey"
    FOREIGN KEY ("outlet_id") REFERENCES "pos_outlet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_reservation" ADD CONSTRAINT "pos_reservation_table_id_fkey"
    FOREIGN KEY ("table_id") REFERENCES "pos_table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pos_reservation" ADD CONSTRAINT "pos_reservation_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "pos_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
