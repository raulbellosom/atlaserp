-- Add terminal_id to pos_order for explicit terminal ownership tracking
ALTER TABLE "pos_order" ADD COLUMN "terminal_id" UUID REFERENCES "pos_terminal"("id") ON DELETE SET NULL;

CREATE INDEX "pos_order_terminal_id_idx" ON "pos_order"("terminal_id");
