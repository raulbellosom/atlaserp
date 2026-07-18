-- PosWaiterShift
CREATE TABLE "pos_waiter_shift" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "waiter_id" UUID NOT NULL,
    "status" "pos_session_status" NOT NULL DEFAULT 'OPEN',
    "expected_cash_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "delivered_amount" DECIMAL(12,2),
    "delivered_to_session_id" UUID,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "notes" TEXT,
    CONSTRAINT "pos_waiter_shift_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pos_waiter_shift_company_id_outlet_id_status_idx" ON "pos_waiter_shift"("company_id", "outlet_id", "status");
CREATE INDEX "pos_waiter_shift_company_id_waiter_id_status_idx" ON "pos_waiter_shift"("company_id", "waiter_id", "status");
ALTER TABLE "pos_waiter_shift" ADD CONSTRAINT "pos_waiter_shift_outlet_id_fkey"
    FOREIGN KEY ("outlet_id") REFERENCES "pos_outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_waiter_shift" ADD CONSTRAINT "pos_waiter_shift_delivered_to_session_id_fkey"
    FOREIGN KEY ("delivered_to_session_id") REFERENCES "pos_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PosPayment money containers
ALTER TABLE "pos_payment"
    ADD COLUMN "session_id" UUID,
    ADD COLUMN "waiter_shift_id" UUID;
UPDATE "pos_payment" p SET "session_id" = o."session_id"
    FROM "pos_order" o WHERE p."order_id" = o."id" AND o."session_id" IS NOT NULL;
CREATE INDEX "pos_payment_session_id_idx" ON "pos_payment"("session_id");
CREATE INDEX "pos_payment_waiter_shift_id_idx" ON "pos_payment"("waiter_shift_id");
ALTER TABLE "pos_payment" ADD CONSTRAINT "pos_payment_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "pos_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_payment" ADD CONSTRAINT "pos_payment_waiter_shift_id_fkey"
    FOREIGN KEY ("waiter_shift_id") REFERENCES "pos_waiter_shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- NOT VALID: legacy payments on session-less orders keep both columns NULL; new rows must pick exactly one.
ALTER TABLE "pos_payment" ADD CONSTRAINT "pos_payment_money_container_check"
    CHECK (num_nonnulls("session_id", "waiter_shift_id") = 1) NOT VALID;

-- PosOutlet behavior flags
ALTER TABLE "pos_outlet"
    ADD COLUMN "allow_table_charge" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "default_station_id" UUID,
    ADD COLUMN "kitchen_kds_enabled" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "kitchen_print_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pos_outlet" ADD CONSTRAINT "pos_outlet_default_station_id_fkey"
    FOREIGN KEY ("default_station_id") REFERENCES "pos_kitchen_station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
