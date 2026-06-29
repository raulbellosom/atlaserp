ALTER TABLE "pos_order" ADD COLUMN "waiter_id" UUID;
ALTER TABLE "pos_table" ADD COLUMN "waiter_id" UUID;
CREATE INDEX "pos_order_waiter_id_idx" ON "pos_order"("waiter_id");
CREATE INDEX "pos_table_waiter_id_idx" ON "pos_table"("waiter_id");
