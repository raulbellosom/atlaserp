-- Calendars have always been purely user-owned, with no company at all —
-- flagged in the multi-tenant audit as the reason calendar-notification-
-- service.js's reminder worker has to guess a company via an arbitrary
-- membership pick. Raul decided (2026-09-11): calendars should carry an
-- optional company, visible to the user, and reminder notifications should
-- name the company when the calendar has one. Nullable and additive — every
-- existing calendar keeps company_id = NULL (unchanged behavior); new
-- calendars are assigned the creator's active company at creation time
-- (application-level default, not a DB default, since "active company" is a
-- per-request concept).

ALTER TABLE calendar_calendar ADD COLUMN company_id UUID REFERENCES company(id) ON DELETE SET NULL;

CREATE INDEX calendar_calendar_company_idx ON calendar_calendar(company_id) WHERE company_id IS NOT NULL;
