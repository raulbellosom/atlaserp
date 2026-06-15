\set ON_ERROR_STOP on
\timing on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE growth_visitor (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  site_id uuid NOT NULL,
  consent_state text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL
);

CREATE TABLE growth_session (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  site_id uuid NOT NULL,
  visitor_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  landing_path text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  visible_seconds integer NOT NULL,
  pageview_count integer NOT NULL,
  has_conversion boolean NOT NULL,
  engaged boolean NOT NULL
);

CREATE TABLE growth_event (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  site_id uuid NOT NULL,
  visitor_id uuid,
  session_id uuid,
  event_name text NOT NULL,
  server_received_at timestamptz NOT NULL,
  path text,
  properties jsonb,
  form_id uuid,
  consent_state text NOT NULL
);

CREATE TABLE growth_lead (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  site_id uuid NOT NULL,
  enabled boolean NOT NULL,
  created_at timestamptz NOT NULL,
  qualified_at timestamptz,
  converted_at timestamptz
);

CREATE TABLE growth_daily_metric (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  site_id uuid NOT NULL,
  metric_date date NOT NULL,
  dimension_type text NOT NULL,
  dimension_key text NOT NULL,
  metrics jsonb NOT NULL
);

CREATE INDEX growth_visitor_company_last_seen_idx
  ON growth_visitor (company_id, last_seen_at);
CREATE INDEX growth_session_company_site_started_idx
  ON growth_session (company_id, site_id, started_at);
CREATE INDEX growth_session_visitor_last_seen_idx
  ON growth_session (visitor_id, last_seen_at);
CREATE INDEX growth_event_company_site_received_idx
  ON growth_event (company_id, site_id, server_received_at);
CREATE INDEX growth_event_session_received_idx
  ON growth_event (session_id, server_received_at);
CREATE INDEX growth_event_name_received_idx
  ON growth_event (event_name, server_received_at);
CREATE INDEX growth_event_form_idx ON growth_event (form_id);
CREATE INDEX growth_lead_company_status_created_idx
  ON growth_lead (company_id, enabled, created_at);
CREATE UNIQUE INDEX growth_daily_metric_dimension_key
  ON growth_daily_metric (
    site_id,
    metric_date,
    dimension_type,
    dimension_key
  );
CREATE INDEX growth_daily_metric_company_date_idx
  ON growth_daily_metric (company_id, metric_date);

INSERT INTO growth_visitor
SELECT
  ('00000000-0000-7000-8000-' || lpad(series::text, 12, '0'))::uuid,
  '00000000-0000-7000-8000-000000000001'::uuid,
  '00000000-0000-7000-8000-000000000002'::uuid,
  'granted',
  timestamptz '2026-01-01' + (series % 150) * interval '1 day',
  timestamptz '2026-06-14' - (series % 30) * interval '1 day'
FROM generate_series(1, 100000) AS series;

INSERT INTO growth_session
SELECT
  gen_random_uuid(),
  '00000000-0000-7000-8000-000000000001'::uuid,
  '00000000-0000-7000-8000-000000000002'::uuid,
  ('00000000-0000-7000-8000-' || lpad(((series % 100000) + 1)::text, 12, '0'))::uuid,
  timestamptz '2026-05-01' + (series % 45) * interval '1 day'
    + (series % 86400) * interval '1 second',
  timestamptz '2026-05-01' + (series % 45) * interval '1 day'
    + ((series % 86400) + 600) * interval '1 second',
  CASE series % 4
    WHEN 0 THEN '/'
    WHEN 1 THEN '/precios'
    WHEN 2 THEN '/servicios'
    ELSE '/contacto'
  END,
  CASE series % 5
    WHEN 0 THEN NULL
    WHEN 1 THEN 'google'
    WHEN 2 THEN 'facebook'
    WHEN 3 THEN 'newsletter'
    ELSE 'partner'
  END,
  CASE WHEN series % 5 = 0 THEN NULL ELSE 'campaign' END,
  CASE WHEN series % 3 = 0 THEN 'june' ELSE NULL END,
  series % 180,
  (series % 5) + 1,
  series % 20 = 0,
  series % 3 <> 0
FROM generate_series(1, 200000) AS series;

INSERT INTO growth_event
SELECT
  gen_random_uuid(),
  '00000000-0000-7000-8000-000000000001'::uuid,
  '00000000-0000-7000-8000-000000000002'::uuid,
  ('00000000-0000-7000-8000-' || lpad(((series % 100000) + 1)::text, 12, '0'))::uuid,
  NULL,
  CASE series % 10
    WHEN 0 THEN 'form_view'
    WHEN 1 THEN 'form_start'
    WHEN 2 THEN 'form_submit'
    WHEN 3 THEN 'pricing_cta'
    ELSE 'page_view'
  END,
  timestamptz '2026-05-01' + (series % 45) * interval '1 day'
    + (series % 86400) * interval '1 second',
  CASE series % 4
    WHEN 0 THEN '/'
    WHEN 1 THEN '/precios'
    WHEN 2 THEN '/servicios'
    ELSE '/contacto'
  END,
  CASE
    WHEN series % 10 = 3
      THEN '{"label":"Cotizar","placement":"hero"}'::jsonb
    ELSE '{}'::jsonb
  END,
  CASE
    WHEN series % 10 IN (0, 1, 2)
      THEN '00000000-0000-7000-8000-000000000003'::uuid
    ELSE NULL
  END,
  'granted'
FROM generate_series(1, 1000000) AS series;

INSERT INTO growth_lead
SELECT
  gen_random_uuid(),
  '00000000-0000-7000-8000-000000000001'::uuid,
  '00000000-0000-7000-8000-000000000002'::uuid,
  true,
  timestamptz '2026-05-01' + (series % 45) * interval '1 day',
  CASE
    WHEN series % 2 = 0
      THEN timestamptz '2026-05-01' + (series % 45) * interval '1 day'
    ELSE NULL
  END,
  CASE
    WHEN series % 5 = 0
      THEN timestamptz '2026-05-01' + (series % 45) * interval '1 day'
    ELSE NULL
  END
FROM generate_series(1, 20000) AS series;

INSERT INTO growth_daily_metric
SELECT
  gen_random_uuid(),
  '00000000-0000-7000-8000-000000000001'::uuid,
  '00000000-0000-7000-8000-000000000002'::uuid,
  day::date,
  dimension_type,
  dimension_type || '-' || day::date::text,
  '{"sessions":1000,"engagedSessions":700,"pageviews":5000}'::jsonb
FROM generate_series(date '2024-05-01', date '2026-06-13', interval '1 day') day
CROSS JOIN unnest(ARRAY[
  'site', 'source', 'landing', 'page', 'cta', 'form', 'funnel', 'retention'
]) dimension_type;

ANALYZE;

\echo 'REPORT aggregate_range'
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM growth_daily_metric
WHERE company_id = '00000000-0000-7000-8000-000000000001'::uuid
  AND site_id = '00000000-0000-7000-8000-000000000002'::uuid
  AND metric_date >= date '2024-05-01'
  AND metric_date < date '2026-06-14'
ORDER BY metric_date, dimension_type, dimension_key;

\echo 'REPORT acquisition_tail'
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  COALESCE(NULLIF(utm_source, ''), 'Directo') AS source,
  COALESCE(NULLIF(utm_medium, ''), 'Sin medio') AS medium,
  COALESCE(NULLIF(utm_campaign, ''), 'Sin campana') AS campaign,
  COUNT(*) AS sessions,
  COUNT(*) FILTER (WHERE engaged) AS engaged_sessions,
  COUNT(*) FILTER (WHERE has_conversion) AS conversions
FROM growth_session
WHERE company_id = '00000000-0000-7000-8000-000000000001'::uuid
  AND site_id = '00000000-0000-7000-8000-000000000002'::uuid
  AND started_at >= timestamptz '2026-06-13'
  AND started_at < timestamptz '2026-06-14'
GROUP BY utm_source, utm_medium, utm_campaign;

\echo 'REPORT content_tail'
EXPLAIN (ANALYZE, BUFFERS)
SELECT path, COUNT(*) AS pageviews, COUNT(DISTINCT visitor_id) AS visitors
FROM growth_event
WHERE company_id = '00000000-0000-7000-8000-000000000001'::uuid
  AND site_id = '00000000-0000-7000-8000-000000000002'::uuid
  AND server_received_at >= timestamptz '2026-06-12'
  AND server_received_at < timestamptz '2026-06-13'
  AND consent_state <> 'denied'
  AND event_name = 'page_view'
GROUP BY path;

\echo 'REPORT cta_tail'
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  event_name,
  COUNT(*) AS clicks,
  COUNT(DISTINCT visitor_id) AS visitors
FROM growth_event
WHERE company_id = '00000000-0000-7000-8000-000000000001'::uuid
  AND site_id = '00000000-0000-7000-8000-000000000002'::uuid
  AND server_received_at >= timestamptz '2026-06-13'
  AND server_received_at < timestamptz '2026-06-14'
  AND consent_state <> 'denied'
  AND event_name = 'pricing_cta'
GROUP BY event_name;

\echo 'REPORT forms_tail'
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  form_id,
  COUNT(*) FILTER (WHERE event_name = 'form_view') AS views,
  COUNT(*) FILTER (WHERE event_name = 'form_start') AS starts,
  COUNT(*) FILTER (WHERE event_name = 'form_submit') AS submits
FROM growth_event
WHERE company_id = '00000000-0000-7000-8000-000000000001'::uuid
  AND site_id = '00000000-0000-7000-8000-000000000002'::uuid
  AND server_received_at >= timestamptz '2026-06-12'
  AND server_received_at < timestamptz '2026-06-13'
  AND consent_state <> 'denied'
  AND form_id IS NOT NULL
GROUP BY form_id;

\echo 'REPORT retention_cohort'
EXPLAIN (ANALYZE, BUFFERS)
SELECT
  visitor.first_seen_at::date AS cohort_date,
  COUNT(DISTINCT visitor.id) AS cohort_visitors,
  COUNT(DISTINCT visitor.id) FILTER (
    WHERE EXISTS (
      SELECT 1
      FROM growth_session session
      WHERE session.visitor_id = visitor.id
        AND session.started_at::date = visitor.first_seen_at::date + 7
    )
  ) AS d7
FROM growth_visitor visitor
WHERE visitor.company_id =
    '00000000-0000-7000-8000-000000000001'::uuid
  AND visitor.site_id =
    '00000000-0000-7000-8000-000000000002'::uuid
  AND visitor.first_seen_at >= timestamptz '2026-05-01'
  AND visitor.first_seen_at < timestamptz '2026-06-14'
  AND visitor.consent_state <> 'denied'
GROUP BY visitor.first_seen_at::date;
