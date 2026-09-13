# Notifications across Atlas runtimes

User requires Web/PWA push and Android background call alerts while retaining Desktop, in-app and email delivery.

Confirmed audit findings: browser subscription registration disables other endpoints sharing a user-agent; the delivery worker also collapses distinct endpoints by user-agent. A user-agent is not an installation identity. Browser auto-registration only tries once per login and can silently remain unsynchronized after a transient API/auth error. Native Android has local notifications only; no FCM registration or receiver exists. Native iOS is not implemented.

Implement and test: keep distinct Web Push endpoints enabled and deliver to each; retain permanent-error cleanup. Retry subscription synchronization on reconnect/focus with bounded throttling and maintain native/Web/PWA routing isolation. Confirm service worker notification and click behavior with executable fixture tests. No push is sent to real users during tests.

Architecture: Atlas remains the authority for events, recipients, preferences and delivery jobs. Web/PWA uses the existing VAPID/Web Push path; Android native requires an FCM transport/receiver plus system call UI for background incoming calls. iOS native requires APNs and PushKit/CallKit for VoIP. LiveKit carries call media, not the push invitation. Firebase project availability is pending user input; do not claim native background reception or WhatsApp-like call lifecycle is implemented.

Do not deploy or mutate production configuration/keys during diagnostics. Read-only delivery statistics are insufficient to prove device receipt. No database migration is needed for the endpoint-selection fix.

Verified: backend/push tests 35 passed; browser/native-routing/worker tests 18 passed (one preparation test is common to both runs). Vite build and ESLint passed; React Doctor 100/100. Production worker script matched the repository and was served as JavaScript. Runtime capabilities and remaining native implementation are documented in `docs/mobile/NOTIFICATIONS_AND_CALLS.md`. No deployment or real-recipient test send was performed.
