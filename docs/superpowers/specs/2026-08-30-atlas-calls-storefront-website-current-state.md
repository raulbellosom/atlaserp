# atlas.calls / atlas.storefront / atlas.website — Current State Spec

**Date:** 2026-08-30
**Modules:** `atlas.calls` (LiveKit voice/video, lives under `atlas.chat`),
`atlas.storefront` (customer-facing auth/capture/config), `atlas.website`
(website + blog + checkout builder). Peripheral tier (D9), lower priority than
the core business modules audited earlier in this campaign.
**Status:** Post-audit reference (2026-08-30 pass, same rigor as `atlas.ledger`).

---

## 1. Layout

```
apps/api/src/routes/calls/       call-service.js (619), index.js (75)
apps/api/src/routes/storefront/  storefront-auth-routes.js, -capture-routes.js
                                  (299), -config-routes.js, -files-routes.js,
                                  -middleware.js, storefront-router.js
apps/api/src/routes/website/     website-service.js (878), checkout-routes.js,
                                  blog/bookings/forms/menus/pages/themes-routes.js,
                                  dist-routes.js, index.js
apps/desktop/src/modules/atlas.chat/calls/  CallRoom.jsx, CallRoomLayout.jsx,
                                             CallsProvider.jsx, IncomingCallDialog.jsx
packages/storefront-sdk/         public client SDK (auth/catalog/forms/files/
                                  guestChat/realtime) — no checkout/cart support
                                  yet, confirming the checkout route audited
                                  below has no first-party caller in this repo
```

## 2. `atlas.calls` — clean, no changes needed

The best-engineered module found in this entire campaign, on par with
`atlas.growth`/`atlas.documents`. `createCall` locks all participant rows in
UUID order inside a transaction (`SELECT ... FOR UPDATE`) specifically to
avoid deadlocks when two users call each other simultaneously; busy-call
detection is race-free (checked inside the same locked transaction, not a
separate read); `assertCallAccess` verifies both conversation membership and
that the caller is an actual participant of *this* call; the LiveKit token
grants access to exactly one room (`call.livekitRoomName`); `endCall` allows
either the initiator or a caller holding the channel's `channel.manage`
permission to end it for everyone. No `calls.*` RBAC permission exists by
design — authorization is entirely membership-based (you can't call, join,
decline, leave, or end a call without already being a participant/member of
the underlying conversation), which is a legitimate, deliberate boundary, not
a gap. 12/12 tests pass.

**Feature gap (not a bug, logged as backlog F1 per user request 2026-08-30):**
no mid-call audio→video upgrade — `Call.kind` is fixed at creation and the
camera-toggle UI is hidden for AUDIO calls (`CallRoomLayout.jsx:206`) even
though the underlying LiveKit mechanism has no such restriction. See the
backlog entry for the implementation sketch.

## 3. `atlas.website` — checkout price-tampering (fixed)

**`POST /public/checkout` built the Stripe line items directly from
client-supplied `item.price`, `item.currency`, and `item.name` — with zero
server-side re-validation against the actual product.** A tampered request
(browser devtools, or curl entirely bypassing any storefront UI — there is no
first-party caller of this endpoint in this repo; see `packages/storefront-sdk`,
which has no checkout support, so this looks like a route built ahead of its
own cart UI) could set `item.price` to anything, e.g. `0.01`, and Stripe would
create a checkout session for that price. This is the same severity class as
a payment-bypass bug: direct financial loss, not just data exposure.

**Fix:** the request body's cart lines now only need `{ productId, variantId?,
qty }`. The route resolves `price`/`currency`/`name` server-side from
`catalog_product` / `catalog_product_variant` (raw `$queryRaw`, not a
`prisma.<model>` accessor — these AME3-managed tables have no generated
Prisma Client entry despite the `model CatalogProduct` block existing in
`schema.prisma`; confirmed by grepping the generated `.prisma/client/index.d.ts`
before writing the fix), scoped to the site's own `company_id` and
`enabled: true, published: true`. A `variantId` is validated to belong to the
resolved `productId` before its price is used. `client-supplied price/currency/
name fields are now fully ignored.

To make this testable, `createPublicCheckoutRouter` now accepts optional
`StripeImpl`/`decryptPasswordImpl` injection points (mirrors the
`AccessTokenImpl`/`RoomServiceClientImpl` pattern already used in
`call-service.js`) — defaults are unchanged, so the existing `index.js` call
site (`createPublicCheckoutRouter({ prisma })`) needed no changes. New
`checkout-routes.test.js` (7 tests) proves the tampered-price case explicitly:
sends `price: 0.01` for a product whose real catalog price is 500.00, asserts
Stripe's `unit_amount` is `50000` (the real price), not `1`.

`website-service.js` (878 lines, ~60 functions) was otherwise audited and
found clean — every function takes `companyId`, every mutation does a
`findFirst({ where: { id, companyId } })` ownership check before writing.

## 4. `atlas.storefront` — clean, no changes needed

`storefront-auth-service.js`'s self-registration flow validates the requested
`role` against an admin-configured allowlist
(`InstanceConfig['storefront.registrable_roles']`) via `validateRegistrableRole`
— a self-registering customer cannot pick an arbitrary role (e.g. an internal
admin role); only whatever the instance owner has explicitly opted into
letting customers self-assign. No `SELECT *` / raw-row leaks found in
`storefront-capture-routes.js`'s public responses (they go through explicit
builder functions, e.g. `publicFormData(form)`).

## 5. Known gaps / follow-ups (backlog)

- **F1** (new, user-requested 2026-08-30) — `atlas.calls` mid-call audio→video
  upgrade. Needs its own spec before implementation.
- No responsive/browser QA performed this session.
- Minor, not fixed: `website-service.js`'s `createMenuItem` doesn't validate
  that `data.pageId`/`data.parentId` belong to the caller's own company —
  low severity (would only create a broken nav link within the caller's own
  site, no cross-tenant data exposure), not chased given the campaign's
  effort budget.

## 6. Verification (2026-08-30)

- `node --check` on `checkout-routes.js` — pass.
- `node --test "apps/api/src/routes/calls/__tests__/*.test.js"` — 12/12.
- `node --test "apps/api/src/routes/website/__tests__/checkout-routes.test.js"`
  — 7/7 (new).
- Full API test dirs — 824/824 (was 817).
- `pnpm --filter @atlas/desktop build:web` — clean build.
