# Chat presence recovery

User reports missing online status and asks whether Android or tenant isolation caused it.

Confirmed: `useChatPresence` reads `user`, which AuthProvider does not expose; it never creates a conversation presence channel. The installed Supabase client reuses channels by topic, so multiple conversation views also need shared ownership instead of subscribing/removing each other's channel.

Implement: use the profile identity, share conversation subscriptions with reference-counted cleanup, reset conversation transient state and ignore late events after cleanup. Keep private channels and membership authorization. No FCM implementation or database migration in this fix.

Verify: behavioral Node tests with a fake transport for multiple views, cleanup/remount and typing; build/ESLint/React Doctor. Read-only database audit confirmed installed realtime policies, authenticated member SELECT/INSERT authorization and rejection of a synthetic nonmember. This does not establish that the user's deployed web currently connects successfully; browser/APK comparison is pending.

User clarification: online status disappears when the other user switches active company; this matches the current company-scoped design, rather than establishing an APK regression. Recommendation discussed: account availability visible only to authorized colleagues, independent of the other person's active company; do not reveal which other company they are using. That product change is not implemented here. The existing per-conversation/global-company fallback is preserved.

Verified: five behavioral Node tests passed (shared views, disconnect/reconnect, remount, account replacement, asynchronous removal). ESLint and Vite production build passed; React Doctor on changed tracked frontend files: 100/100. Database inspection was read-only, with no schema/data changes. No deployment or APK rebuild performed for this frontend fix.
