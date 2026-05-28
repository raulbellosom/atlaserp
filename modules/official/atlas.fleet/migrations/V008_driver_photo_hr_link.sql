ALTER TABLE fleet_driver
  ADD COLUMN IF NOT EXISTS hr_employee_id text;

CREATE INDEX IF NOT EXISTS fleet_driver_company_hr_employee_idx
  ON fleet_driver(company_id, hr_employee_id);
