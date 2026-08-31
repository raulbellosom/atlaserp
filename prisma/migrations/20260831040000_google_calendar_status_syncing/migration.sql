-- Add the missing SYNCING value to google_calendar_source_status.
-- The Google Calendar import + import-recovery services (added in aee3e06d)
-- write and query syncStatus = 'SYNCING', but the enum never had it — every
-- import-recovery worker tick threw "Invalid value for argument `in`".

ALTER TYPE "google_calendar_source_status" ADD VALUE IF NOT EXISTS 'SYNCING' BEFORE 'ACTIVE';
