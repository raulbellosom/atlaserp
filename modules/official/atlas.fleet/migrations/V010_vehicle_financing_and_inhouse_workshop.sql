-- V010: vehicle financing fields + in-house workshop flag for reports
-- Date: 2026-05-24
-- Safe: additive migration (ADD COLUMN IF NOT EXISTS)

ALTER TABLE fleet_vehicle
  ADD COLUMN IF NOT EXISTS is_financed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS financing_institution varchar(200),
  ADD COLUMN IF NOT EXISTS financing_contract_number varchar(120),
  ADD COLUMN IF NOT EXISTS financing_start_date date,
  ADD COLUMN IF NOT EXISTS financing_end_date date,
  ADD COLUMN IF NOT EXISTS financing_monthly_payment numeric(12,2),
  ADD COLUMN IF NOT EXISTS financing_notes text;

ALTER TABLE fleet_report
  ADD COLUMN IF NOT EXISTS is_inhouse_workshop boolean NOT NULL DEFAULT false;
