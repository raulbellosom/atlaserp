# Android call capabilities

Spec: `docs/superpowers/specs/2026-09-11-atlas-native-host-design.md`, Android calls follow-up.
Mode: IMPLEMENTATION — user requested the fixes and continuation.

1. Fix local notifications in `src/native/`, `systemNotifications.js`, `CallsProvider.jsx`, `usePushAutoSubscribe.js`, native capabilities and diagnostics; test channel, IDs, click/dismiss behavior. Do not claim background push is active.
2. Add native screen sharing in Android `ScreenSharePlugin.kt`, Rust `mobile_media.rs`, manifest/Gradle, native bridge and `CallRoom.jsx`; reuse MediaProjection and LiveKit Android SDK. Add authenticated screen-token API/SDK method with narrow grants and tests. Gate old APKs, stop on leave/revocation and hide companion identities from participant counts while preserving their screen track.
3. Compile/test JS, Rust and Android; inspect emulator consent, notifications and screen publishing where infrastructure permits. Rebuild debug APK, document actual evidence and remaining Firebase/physical-device requirements. Keep artifacts ignored.

No production deployment, external test calls to real users, credentials committed, or new database tables. Firebase configuration question is pending; do not infer configuration from Android notification permission.

Implementation and isolated verification completed. Android notifications use a native PendingIntent with an Atlas URI because the installed Tauri notification plugin loses the notification payload on tap. Existing deep-link queue/ACK handles navigation; channel creation, permission and dismissal still use the plugin. Details and pending authenticated/physical-device acceptance are recorded in `docs/mobile/ATLAS_NATIVE_HOST.md`.
