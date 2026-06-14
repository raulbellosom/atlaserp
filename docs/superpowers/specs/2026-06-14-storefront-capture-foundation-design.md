# Storefront Capture Foundation

Date: 2026-06-14
Status: Proposed
Author: Codex
Spec file: `docs/superpowers/specs/2026-06-14-storefront-capture-foundation-design.md`
Plan file: `docs/superpowers/plans/2026-06-14-storefront-capture-foundation.md`

---

## 1. Feature title

Storefront Capture Foundation

## 2. Status

Proposed

## 3. Context

Atlas Website serves the public domain from either the visual builder or an uploaded `dist`. It already injects `window.ATLAS_CONFIG`, exposes the Storefront SDK, and stores basic form submissions, but it has no unified visitor/session telemetry or reliable form-to-lead flow.

## 4. Problem

Builder and `dist` sites cannot measure acquisition and conversion through one first-party contract. The existing public form endpoint also reads columns that do not match the Prisma schema, does not validate submitted values against configured fields, and does not provide idempotency, attribution, consent, or lead creation.

## 5. Goals

1. Provide one versioned public API for site configuration, analytics events, form definitions, and submissions.
2. Extend `@raulbellosom/atlas-sdk` and `/atlas-sdk.js` with analytics and form APIs usable by Builder, React storefronts, and plain HTML.
3. Capture privacy-limited visitor, session, event, attribution, submission, and lead records.
4. Apply configurable consent, DNT, origin validation, rate limits, payload limits, honeypot protection, idempotency, and optional Turnstile.
5. Preserve 90 days of raw events and 25 months of session/daily aggregates.

## 6. Non-goals

1. Lead-management UI, assignments, notes, or conversion to Contacts.
2. Advanced dashboards, arbitrary funnels, heatmaps, replay, or A/B tests.
3. External analytics providers as the primary data source.
4. Cross-device visitor identity.

## 7. User stories

- As a storefront developer, I want one SDK for forms and analytics so Builder and `dist` behave consistently.
- As a website administrator, I want configurable consent and antispam controls so capture follows the site's policy.
- As a future Growth user, I want submissions linked to attribution and leads so the commercial path is traceable.

## 8. UX requirements

- Website settings expose tracking mode: `off`, `anonymous`, or `consent_required`.
- Form settings expose “Crear lead”, default responsible user, honeypot, and optional Turnstile requirement.
- Builder renders the configured form fields instead of a fixed name/email/message form.
- Widget and Builder forms show accessible loading, success, validation, rate-limit, CAPTCHA, and server error states in Spanish.
- Analytics must never block navigation or form rendering.

## 9. Routes/screens

| Route | Screen | Module | Description |
|---|---|---|---|
| `/app/m/atlas.website/settings` | `WebsiteSettingsScreen` | `atlas.website` | Tracking policy and public Turnstile configuration |
| `/app/m/atlas.website/forms` | `WebsiteFormsScreen` | `atlas.website` | Lead and antispam settings per form |

`atlas.growth` has no navigation in this phase.

## 10. Data model

### Modified models

- `WebsiteSite`: `analyticsMode`, `turnstileSiteKey`, encrypted `turnstileSecretKey`.
- `WebsiteForm`: `createsLead`, `defaultAssigneeUserId`, `honeypotEnabled`, `turnstileRequired`.
- `WebsiteFormField`: `semanticKey` with `name`, `email`, `phone`, `company`, `message`, or `custom`.
- `WebsiteFormSubmission`: `idempotencyKey`, `visitorId`, `sessionId`, `leadId`; retain submitted `data`, never persist raw IP.

### New models

- `GrowthVisitor`: company/site scope, opaque `visitorKeyHash`, consent state, first/last seen, normalized device family, optional authenticated profile.
- `GrowthSession`: visitor, landing/exit paths, referrer host, UTM fields, started/last activity, visible seconds, pageview/event counts, conversion flag.
- `GrowthEvent`: company/site/visitor/session, idempotency key, name, client/server timestamps, path, safe properties, optional form/submission references.
- `GrowthLead`: normalized name/email/phone/company/message, status `new`, priority `normal`, source, attribution, assignee, first/last submission, first/last seen, enabled.
- `GrowthLeadActivity`: lead, activity type, source entity, payload, optional actor, creation date.
- `GrowthDailyMetric`: company/site/date/dimension type/dimension key and numeric metric JSON.

Unique constraints:

- visitor: `(siteId, visitorKeyHash)`.
- event: `(siteId, idempotencyKey)`.
- submission: `(formId, idempotencyKey)`.
- daily metric: `(siteId, metricDate, dimensionType, dimensionKey)`.

## 11. Prisma impact

New models: `GrowthVisitor`, `GrowthSession`, `GrowthEvent`, `GrowthLead`, `GrowthLeadActivity`, `GrowthDailyMetric`.

Modified models: `WebsiteSite`, `WebsiteForm`, `WebsiteFormField`, `WebsiteFormSubmission`.

New forward migration required: Yes.

Migration safety: all Website columns are nullable or have defaults. Existing submissions remain valid. No applied migration is edited.

## 12. API contract

### GET `/public/storefront/v1/config`

Auth: none. Headers: `X-Atlas-Company`, optional `X-Atlas-Site`.

Response:

```json
{
  "data": {
    "siteId": "uuid",
    "analyticsMode": "consent_required",
    "respectDoNotTrack": true,
    "turnstileSiteKey": "public-key-or-null",
    "capabilities": { "analytics": true, "forms": true }
  }
}
```

### POST `/public/storefront/v1/events/batch`

Auth: optional bearer token. Maximum 50 events and 64 KB request body.

Body:

```json
{
  "visitorId": "opaque-client-id",
  "sessionId": "opaque-client-id",
  "consent": "granted",
  "events": [{
    "id": "idempotency-key",
    "name": "page_view",
    "occurredAt": "ISO-8601",
    "path": "/productos",
    "properties": {}
  }]
}
```

Response: `202 { "data": { "accepted": 1, "rejected": [] } }`.

Errors: `400` missing site headers, `403` invalid origin or policy, `413` oversized body, `422` invalid event, `429` rate limit.

### GET `/public/storefront/v1/forms/:formId`

Auth: none. Returns enabled public metadata and enabled fields only.

### POST `/public/storefront/v1/forms/:formId/submissions`

Auth: optional. Requires `Idempotency-Key`.

Body:

```json
{
  "values": { "email": "cliente@example.com" },
  "visitorId": "opaque-client-id",
  "sessionId": "opaque-client-id",
  "turnstileToken": "optional",
  "honeypot": ""
}
```

Response: `201 { "data": { "submissionId": "uuid", "leadId": "uuid-or-null", "message": "..." } }`.
An idempotent replay returns `200` with the original identifiers.

### Deprecated adapter

`POST /public/website/forms/:formId/submit` delegates to the new submission service, emits deprecation headers, and remains available for one minor release.

## 13. SDK contract

Package: `@raulbellosom/atlas-sdk` version `0.3.0`.

Client option: optional `siteId`; required when forms/analytics cannot infer it from injected config.

- `sdk.analytics.start()`
- `sdk.analytics.page(properties?)`
- `sdk.analytics.track(name, properties?)`
- `sdk.analytics.setConsent('granted'|'denied')`
- `sdk.analytics.getConsent()`
- `sdk.analytics.flush()`
- `sdk.analytics.stop()`
- `sdk.forms.get(formId)`
- `sdk.forms.submit(formId, values, options?)`

React exports: `useAnalytics`, `usePageView`, `usePublicForm`.

IIFE exports: `window.AtlasERP.analytics` and `window.AtlasERP.renderForm(target, options)`.

## 14. Validator contract

Shared Zod schemas:

- `storefrontEventSchema`: allowed event name, timestamps, path, and safe properties.
- `storefrontEventBatchSchema`: IDs, consent, one to 50 events.
- `publicFormSubmissionSchema`: values, visitor/session IDs, CAPTCHA token, honeypot.
- Website validators add analytics, antispam, lead, assignee, and semantic-field settings.

Forbidden event property keys include email, phone, password, token, authorization, cookie, message, and form values. Properties allow scalar values only, maximum 20 keys.

## 15. Module manifest impact

Add official `atlas.growth` manifest:

- kind: core feature, `core: true`, `uninstallable: false`.
- dependencies: `atlas.core`, `atlas.website`, `atlas.contacts`.
- PWA: icon `TrendingUp`, color `#7C3AED`, short name `Crecimiento`, start path `/`.
- no navigation in this phase.
- lifecycle owns all six Growth models and shares Company, Website, UserProfile, Contact, and AuditLog.

## 16. Navigation impact

No Growth navigation in this phase. Website routes remain unchanged.

## 17. Blueprint impact

N/A. Official screens and public SDK/widget code are used.

## 18. RBAC/permissions

Declare the permissions needed by later Growth phases now:

- `growth.access`
- `growth.leads.read/create/update/delete/assign/convert`
- `growth.analytics.read/export`

No public ingestion endpoint uses ERP RBAC. Website settings remain guarded by existing Website permissions.

## 19. Multi-company behavior

Every public request resolves company by `X-Atlas-Company`, then verifies the site belongs to that company. Optional `X-Atlas-Site` must match. Every query includes both company and site scope. Authenticated profile linking is allowed only for a membership in the resolved company.

## 20. Files/storage impact

N/A.

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

Administrative Website configuration mutations use existing Website audit behavior.

Public events and submissions do not create `AuditLog` rows. Lead creation creates `growth.lead.create` with no raw event payload and no form values beyond normalized lead fields.

## 23. Edge cases

1. DNT always prevents analytics, even when site mode is anonymous.
2. Revoked consent clears queued events and local visitor/session identifiers.
3. An idempotent retry returns the original result without a second submission or activity.
4. A later submission from the same normalized email or phone reuses only an open, enabled, non-converted lead.
5. Invalid/missing semantic mappings still store the submission but may produce a lead with partial fields.
6. Turnstile outages block only forms configured as required.
7. Analytics queue overflow drops oldest events and never blocks the page.
8. Client clocks outside a 24-hour tolerance use server time.

## 24. Risks

1. High event volume. Mitigation: batches, indexes, property limits, daily aggregation, and scheduled purge.
2. Accidental PII in events. Mitigation: allowlisted event shape and forbidden keys; never auto-capture DOM text or form values.
3. Bot submissions. Mitigation: origin checks, bounded in-memory per-instance rate limits, honeypot, idempotency, validation, and optional Turnstile.
4. Multi-instance rate-limit variance. Mitigation: database uniqueness remains authoritative; distributed rate limiting is deferred.

## 25. Acceptance criteria

1. Given Builder or `dist`, when the SDK starts, then it obtains the same site configuration and applies the configured consent policy.
2. Given DNT enabled, when analytics starts, then no visitor, session, or event request is sent.
3. Given a valid batch, when submitted twice with identical event IDs, then each event exists once.
4. Given a configured public form, when submitted, then values are validated against enabled fields.
5. Given `createsLead=true`, when a valid submission arrives, then submission, lead, and activity are committed atomically.
6. Given the same open lead identity and a new submission, then Atlas retains both submissions and adds an activity to one lead.
7. Given the deprecated endpoint, when called, then it delegates successfully and includes deprecation headers.
8. Given a `dist` page and a plain HTML page, when `renderForm` is mounted, then both can submit without React.

## 26. Verification plan

- `pnpm db:generate`
- Apply migration in a disposable database.
- `node --test apps/api/src/routes/storefront/__tests__/capture-*.test.js`
- `node --test packages/storefront-sdk/src/__tests__/analytics.test.js packages/storefront-sdk/src/__tests__/forms.test.js`
- `node --test packages/storefront-sdk/src/__tests__/react-exports.test.js`
- `node --test apps/api/src/services/__tests__/growth-retention-worker.test.js`
- `pnpm --filter @atlas/desktop build:web`
- Manual Builder and uploaded `dist` smoke tests.

## 27. Rollback plan

Disable analytics and forms capabilities in public config, restore Builder to the deprecated adapter, and publish a forward migration that removes new constraints only after data export. Do not edit or reverse an applied migration directly.

## 28. Future enhancements

1. Distributed rate limiting.
2. External PostHog, Plausible, or Matomo adapters.
3. Partitioned raw-event storage above one million monthly events.
4. Geo enrichment from privacy-safe server-side data.
