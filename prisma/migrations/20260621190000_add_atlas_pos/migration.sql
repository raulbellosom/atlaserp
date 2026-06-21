-- CreateEnum
CREATE TYPE "pos_mode" AS ENUM ('RESTAURANT', 'RETAIL', 'HYBRID');

-- CreateEnum
CREATE TYPE "pos_order_status" AS ENUM ('DRAFT', 'OPEN', 'SENT', 'PARTIALLY_SERVED', 'SERVED', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "pos_fulfillment_type" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY', 'PICKUP');

-- CreateEnum
CREATE TYPE "pos_sales_channel" AS ENUM ('IN_STORE', 'PHONE', 'WEBSITE', 'UBER_EATS', 'RAPPI', 'DIDI_FOOD', 'OTHER');

-- CreateEnum
CREATE TYPE "pos_table_status" AS ENUM ('AVAILABLE', 'OCCUPIED', 'BILL_REQUESTED', 'DIRTY', 'RESERVED', 'DISABLED');

-- CreateEnum
CREATE TYPE "pos_kitchen_status" AS ENUM ('PENDING', 'IN_PREPARATION', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "pos_session_status" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "pos_payment_status" AS ENUM ('PENDING', 'CAPTURED', 'VOIDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "pos_external_provider" AS ENUM ('UBER_EATS', 'RAPPI', 'DIDI_FOOD', 'WEBSITE', 'OTHER');

-- CreateTable
CREATE TABLE "pos_settings" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "mode" "pos_mode" NOT NULL DEFAULT 'RESTAURANT',
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "default_tax_rate" DECIMAL(8,4) NOT NULL DEFAULT 16.00,
    "prices_include_tax" BOOLEAN NOT NULL DEFAULT false,
    "tips_enabled" BOOLEAN NOT NULL DEFAULT true,
    "service_charge_rate" DECIMAL(8,4) NOT NULL DEFAULT 0.00,
    "receipt_footer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_outlet" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "mode" "pos_mode" NOT NULL DEFAULT 'RESTAURANT',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_outlet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_terminal" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_terminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_session" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "terminal_id" UUID NOT NULL,
    "opened_by_id" UUID NOT NULL,
    "closed_by_id" UUID,
    "status" "pos_session_status" NOT NULL DEFAULT 'OPEN',
    "opening_cash_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "expected_cash_amount" DECIMAL(12,2),
    "counted_cash_amount" DECIMAL(12,2),
    "difference_amount" DECIMAL(12,2),
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "pos_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_payment_method" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "requires_reference" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_payment_method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_order" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "session_id" UUID,
    "table_id" UUID,
    "order_number" INTEGER NOT NULL,
    "status" "pos_order_status" NOT NULL DEFAULT 'DRAFT',
    "fulfillment_type" "pos_fulfillment_type" NOT NULL DEFAULT 'DINE_IN',
    "sales_channel" "pos_sales_channel" NOT NULL DEFAULT 'IN_STORE',
    "external_provider" "pos_external_provider",
    "external_order_id" TEXT,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "guest_count" INTEGER NOT NULL DEFAULT 1,
    "subtotal_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "tip_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "service_charge_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "raw_external_payload" JSONB,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_order_line" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "order_id" UUID NOT NULL,
    "guest_seat_id" UUID,
    "product_id" UUID,
    "variant_id" UUID,
    "product_name" TEXT NOT NULL,
    "sku" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "tax_rate" DECIMAL(8,4) NOT NULL DEFAULT 0.00,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "preparation_station_id" UUID,
    "kitchen_status" "pos_kitchen_status" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "modifiers_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_guest_seat" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "order_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_guest_seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_payment" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "payment_method_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "pos_payment_status" NOT NULL DEFAULT 'CAPTURED',
    "reference" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "pos_payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_cash_movement" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_cash_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_floor" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "canvas_width" INTEGER NOT NULL DEFAULT 1200,
    "canvas_height" INTEGER NOT NULL DEFAULT 800,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_floor_zone" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "floor_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_floor_zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_table" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "floor_id" UUID NOT NULL,
    "zone_id" UUID,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "status" "pos_table_status" NOT NULL DEFAULT 'AVAILABLE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_table_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_floor_element" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "floor_id" UUID NOT NULL,
    "table_id" UUID,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "x" DECIMAL(12,2) NOT NULL,
    "y" DECIMAL(12,2) NOT NULL,
    "width" DECIMAL(12,2) NOT NULL,
    "height" DECIMAL(12,2) NOT NULL,
    "rotation" DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    "style" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_floor_element_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_kitchen_station" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "color" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_kitchen_station_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_kitchen_ticket" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "station_id" UUID NOT NULL,
    "status" "pos_kitchen_status" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "pos_kitchen_ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_kitchen_ticket_line" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "ticket_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "status" "pos_kitchen_status" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,

    CONSTRAINT "pos_kitchen_ticket_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_product_config" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "variant_id" UUID,
    "station_id" UUID,
    "available_in_pos" BOOLEAN NOT NULL DEFAULT true,
    "requires_preparation" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_product_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_receipt" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "receipt_number" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "printed_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pos_settings_company_id_key" ON "pos_settings"("company_id");

-- CreateIndex
CREATE INDEX "pos_outlet_company_id_enabled_idx" ON "pos_outlet"("company_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "pos_outlet_company_id_code_key" ON "pos_outlet"("company_id", "code");

-- CreateIndex
CREATE INDEX "pos_terminal_company_id_outlet_id_idx" ON "pos_terminal"("company_id", "outlet_id");

-- CreateIndex
CREATE UNIQUE INDEX "pos_terminal_company_id_code_key" ON "pos_terminal"("company_id", "code");

-- CreateIndex
CREATE INDEX "pos_session_company_id_status_idx" ON "pos_session"("company_id", "status");

-- CreateIndex
CREATE INDEX "pos_session_terminal_id_status_idx" ON "pos_session"("terminal_id", "status");

-- CreateIndex
CREATE INDEX "pos_payment_method_company_id_enabled_idx" ON "pos_payment_method"("company_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "pos_payment_method_company_id_code_key" ON "pos_payment_method"("company_id", "code");

-- CreateIndex
CREATE INDEX "pos_order_company_id_status_idx" ON "pos_order"("company_id", "status");

-- CreateIndex
CREATE INDEX "pos_order_company_id_sales_channel_idx" ON "pos_order"("company_id", "sales_channel");

-- CreateIndex
CREATE UNIQUE INDEX "pos_order_company_id_external_provider_external_order_id_key" ON "pos_order"("company_id", "external_provider", "external_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "pos_order_company_id_order_number_key" ON "pos_order"("company_id", "order_number");

-- CreateIndex
CREATE INDEX "pos_order_line_order_id_idx" ON "pos_order_line"("order_id");

-- CreateIndex
CREATE INDEX "pos_order_line_product_id_idx" ON "pos_order_line"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "pos_guest_seat_order_id_position_key" ON "pos_guest_seat"("order_id", "position");

-- CreateIndex
CREATE INDEX "pos_payment_company_id_paid_at_idx" ON "pos_payment"("company_id", "paid_at");

-- CreateIndex
CREATE INDEX "pos_cash_movement_company_id_session_id_idx" ON "pos_cash_movement"("company_id", "session_id");

-- CreateIndex
CREATE INDEX "pos_floor_company_id_outlet_id_idx" ON "pos_floor"("company_id", "outlet_id");

-- CreateIndex
CREATE INDEX "pos_floor_zone_floor_id_idx" ON "pos_floor_zone"("floor_id");

-- CreateIndex
CREATE INDEX "pos_table_company_id_status_idx" ON "pos_table"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pos_table_floor_id_name_key" ON "pos_table"("floor_id", "name");

-- CreateIndex
CREATE INDEX "pos_floor_element_floor_id_idx" ON "pos_floor_element"("floor_id");

-- CreateIndex
CREATE INDEX "pos_kitchen_station_company_id_enabled_idx" ON "pos_kitchen_station"("company_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "pos_kitchen_station_outlet_id_code_key" ON "pos_kitchen_station"("outlet_id", "code");

-- CreateIndex
CREATE INDEX "pos_kitchen_ticket_company_id_station_id_status_idx" ON "pos_kitchen_ticket"("company_id", "station_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pos_kitchen_ticket_line_ticket_id_order_line_id_key" ON "pos_kitchen_ticket_line"("ticket_id", "order_line_id");

-- CreateIndex
CREATE INDEX "pos_product_config_company_id_available_in_pos_idx" ON "pos_product_config"("company_id", "available_in_pos");

-- CreateIndex
CREATE UNIQUE INDEX "pos_product_config_company_id_product_id_variant_id_key" ON "pos_product_config"("company_id", "product_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "pos_receipt_company_id_receipt_number_key" ON "pos_receipt"("company_id", "receipt_number");

-- AddForeignKey
ALTER TABLE "pos_terminal" ADD CONSTRAINT "pos_terminal_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "pos_outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_session" ADD CONSTRAINT "pos_session_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "pos_outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_session" ADD CONSTRAINT "pos_session_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "pos_terminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order" ADD CONSTRAINT "pos_order_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "pos_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order" ADD CONSTRAINT "pos_order_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "pos_table"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_line" ADD CONSTRAINT "pos_order_line_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "pos_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_line" ADD CONSTRAINT "pos_order_line_guest_seat_id_fkey" FOREIGN KEY ("guest_seat_id") REFERENCES "pos_guest_seat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_guest_seat" ADD CONSTRAINT "pos_guest_seat_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "pos_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payment" ADD CONSTRAINT "pos_payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "pos_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_payment" ADD CONSTRAINT "pos_payment_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "pos_payment_method"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_cash_movement" ADD CONSTRAINT "pos_cash_movement_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "pos_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_floor" ADD CONSTRAINT "pos_floor_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "pos_outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_floor_zone" ADD CONSTRAINT "pos_floor_zone_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "pos_floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_table" ADD CONSTRAINT "pos_table_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "pos_floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_table" ADD CONSTRAINT "pos_table_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "pos_floor_zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_floor_element" ADD CONSTRAINT "pos_floor_element_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "pos_floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_kitchen_station" ADD CONSTRAINT "pos_kitchen_station_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "pos_outlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_kitchen_ticket" ADD CONSTRAINT "pos_kitchen_ticket_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "pos_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_kitchen_ticket" ADD CONSTRAINT "pos_kitchen_ticket_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "pos_kitchen_station"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_kitchen_ticket_line" ADD CONSTRAINT "pos_kitchen_ticket_line_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "pos_kitchen_ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_receipt" ADD CONSTRAINT "pos_receipt_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "pos_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
