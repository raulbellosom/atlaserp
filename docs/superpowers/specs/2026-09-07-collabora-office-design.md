# Collabora Office integration

Status: approved under the user's explicit instruction to approve the specification and plan automatically. Supersedes the ONLYOFFICE proposal in `2026-09-07-office-editor-design.md`.

## Findings and scope

Reviewed the current repository at `d9c4f9f5`, including AGENTS/CLAUDE, architecture/core/AME3 documentation, files routes/service, SDK, FilesScreen/viewers, shared attachments, Prisma, installer profiles and recent frontend/networking/chat commits. FileAsset currently has one Storage pointer and no revisions. Its `entityId` is the company for files uploaded through `/files/upload`; `metadata.sourceEntityId` is client supplied and cannot by itself prove attachment access. Current membership permission aggregation spans companies: Office must resolve permissions from the file's actual company, on every WOPI request.

MVP: DOCX/XLSX/PPTX with exact extension/MIME matching. Existing PDF/media viewers and downloads remain available. A shared format catalog, provider boundary, dedicated editor route and shared attachment entry point avoid duplicating integration. Unknown attachment scopes are denied until an authoritative entity access adapter is registered; this is intentional fail-closed behavior, not inferred permission from metadata.

## Architecture

Browser -> SDK -> authenticated Office session -> discovery-selected Collabora action. Submit a short-lived signed WOPI capability in a hidden POST form targeting the editor iframe. Stable `/wopi/files/:id` resource identity is identical across users; access tokens differ. Browser never receives Storage credentials or internal discovery URL. Collabora -> Atlas WOPI -> private Supabase Storage. Atlas alone owns metadata, names, company, authorization, revisions and audit.

Use persistent PostgreSQL row locks and 30-minute WOPI leases on FileAsset. Saves upload a new immutable object, then lock/revalidate the row and compare the original revision before atomically recording the previous pointer and switching the current pointer. Failed uploads/transactions retain the original. Competing saves cannot overwrite a committed newer revision. Identical byte saves are idempotent. Recovery revisions are internal, not a new visible asset or autosave history screen. Lifecycle mutations must serialize with WOPI saves; deleting a versioned document disables it to preserve recovery objects.

WOPI implements CheckFileInfo, GetFile, PutFile, LOCK, REFRESH_LOCK, UNLOCK, GET_LOCK and atomic UnlockAndRelock. RenameFile and PutRelativeFile are explicitly unsupported. Recheck enabled profile, company membership, current permissions, file enabled/format and any registered parent access adapter for every request. Cap token lifetime and request bytes; validate OOXML archive structure and expansion limits; disallow arbitrary fetch URLs, redirects, document paths and unsupported formats. Fixed configured internal discovery URL, bounded response, timeout and cache prevent browser-driven SSRF and repeated probes. Tokens never enter application logs, Storage keys, audit or localStorage.

## Deployment and risk review

CODE is free Development Edition, with no production support/SLA; infrastructure still costs money. CODE's MPL 2.0 obligations apply to covered files/distribution; preserve licensing/notices. No promise of perfect Microsoft Office round-trip fidelity or macro execution. Pin the official `collabora/code:26.04.2.4.1` image, verify it actually pulls/starts. Office is an optional Compose profile for both local/external; failure must not become an API startup dependency. Distinguish API->CODE internal URL, browser->CODE public URL, CODE->WOPI URL and browser host origin. Local loopback HTTP is explicit development configuration; remote deployments require TLS reverse proxy, WebSocket forwarding and exact WOPI host/frame ancestor allowlists. Existing LiveKit proxy owns 80/443, so do not add a competing listener: document adding an Office vhost to the existing proxy.

Mobile uses the same responsive iframe and CODE touch UI, no hover-only Office action. No changes to Tauri security allowances; deployment-specific origins must be permitted by the host's CSP. Native/mobile browser compatibility requires real-device acceptance and is reported separately from automated tests. Token expiration must be visible, with deliberate reopen instead of silently abandoning unsaved edits. Unavailable provider has retry/download fallback.

## Official sources (checked 2026-09-07)

- https://www.collaboraonline.com/code/ — Development Edition and support implications.
- https://hub.docker.com/r/collabora/code/tags — pinned CODE image.
- https://www.collaboraonline.com/blog/code-26-04-release/ — current major release.
- https://www.collaboraonline.com/faqs/ — formats, mobile, collaboration; sizing depends on documents (approximately 1 GB base RAM plus user workload, benchmark on target hardware).
- https://www.collaboraonline.com/terms/collabora-online-mplv2/ and https://www.mozilla.org/en-US/MPL/2.0/FAQ/ — license.
- https://sdk.collaboraonline.com/docs/installation/CODE_Docker_image.html and https://sdk.collaboraonline.com/docs/installation/Proxy_settings.html — deployment (site's anti-bot protection limits automated access; validate against image behavior and official source/examples).
- https://github.com/CollaboraOnline/collabora-online-sdk-examples — integration examples.
- https://github.com/CollaboraOnline/online.mirror/blob/main/wsd/COOLWSD.cpp and `FileServer.cpp` — official source fallback: native environment configuration, content_security_policy and frame ancestry. The pinned image was also exercised directly.
- https://learn.microsoft.com/en-us/microsoft-365/cloud-storage-partner-program/rest/files — WOPI operations, lock responses, 30-minute leases and atomic UnlockAndRelock.

## Acceptance

Authorization, tenant isolation, revoked permissions, token tampering/expiration, bounded input, lock transitions and expiry, storage failure, concurrent saves and previous-version preservation have automated coverage. Validate installer Compose local/external/office, real CODE discovery/health, lint/build and React Doctor. Report any unavailable live Supabase, browser collaboration or native/mobile acceptance honestly.
