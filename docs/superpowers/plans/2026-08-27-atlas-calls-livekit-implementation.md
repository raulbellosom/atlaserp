# Atlas Calls (LiveKit) — Implementation Plan

**Date:** 2026-08-27  
**Source spec:** `docs/superpowers/specs/2026-08-27-atlas-calls-livekit-design.md`  
**Scope:** `atlas.chat`, `atlas.calendar`, SDK, Prisma, desktop/web and installer

## Decisions fixed for implementation

- A conversation may have at most one `RINGING` or `ACTIVE` call. A second
  `POST /calls` returns `409` with the existing `callId`; clients offer joining
  that call instead of creating another room.
- The initiator is created as `JOINED`; the remaining active conversation
  members are `RINGING`. The call becomes `ACTIVE` when another participant
  joins.
- An unanswered call expires after 60 seconds. A small API-side sweeper marks
  remaining `RINGING` participants as `MISSED` and ends calls that never became
  active. The same sweep runs before call mutations, so restart recovery does
  not depend only on an in-memory timer.
- Leaving ends the call when no joined participant remains. The initiator may
  also end the call explicitly; channel admins/owners may force-end it.
- Supabase Postgres Changes is signaling only. Every mutation and every token
  is issued by Hono after conversation-membership checks. Browser roles receive
  `SELECT` only, protected by RLS.
- LiveKit tokens expire after ten minutes and grant only `roomJoin`, publish,
  subscribe and data access for the call's exact room.
- Runtime availability is obtained from `GET /calls/config`; the public LiveKit
  URL is also returned with each token, so installer deployments do not depend
  on a compile-time Vite value.

## Task 1 — Data and security

- Add Prisma enums/models `Call` and `CallParticipant`, including relations to
  `UserProfile` and `CalendarEvent`.
- Add a migration with indexes, uniqueness for one live call per conversation,
  Realtime publication, `authenticated` read grants and RLS policies based on
  active conversation membership.
- Generate Prisma Client and validate the schema.

## Task 2 — Backend and SDK

- Add `livekit-server-sdk` to `@atlas/api`.
- Implement the calls service and Hono routes for config, create, incoming,
  get, join, decline, leave and end.
- Add validation schemas and `@atlas/sdk` methods.
- Cover disabled configuration, membership, duplicate calls, state transitions,
  token secrecy and timeout behavior with `node:test` tests.

## Task 3 — Desktop/web experience

- Add `livekit-client` to `@atlas/desktop`.
- Mount a global calls provider inside the authenticated realtime tree.
- Subscribe to the current user's `call_participant` rows, recover ringing or
  active calls after refresh, and show a global incoming-call dialog.
- Build the in-call surface with remote/local tracks, participant tiles, call
  duration and controls for microphone, camera, screen share and hang-up.
- Add audio/video entry buttons to full and floating chat headers.
- Add “Iniciar llamada” to chat-sourced calendar meetings.

## Task 4 — Installer

- Document and expose `LIVEKIT_MODE`, `LIVEKIT_URL`,
  `LIVEKIT_INTERNAL_URL`, `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
- Add embedded LiveKit + Redis Compose services and the Linux host-network
  override, using one UDP ICE port plus TCP fallback.
- Generate credentials/config in local and external setup flows, validate
  external mode, include the LiveKit profile and pull its images.

## Task 5 — Verification

- Run Prisma validation/generation, targeted backend and SDK tests, full tests,
  web build and repository build.
- Run React Doctor on the final diff and fix introduced diagnostics.
- Verify secrets do not appear in desktop sources or HTTP payloads.
- Leave the two-client WebRTC and real-firewall checks explicitly documented if
  the current environment cannot provide two browser/media sessions.
