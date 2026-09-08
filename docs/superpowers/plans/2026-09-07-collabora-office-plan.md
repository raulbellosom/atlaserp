# Collabora Office implementation plan

Approved automatically as explicitly requested. See the companion Collabora design specification.

1. Add shared format catalog and core FileAsset revision/lease schema with migration.
2. Implement bounded discovery/provider configuration, signed WOPI sessions, per-company authorization and parent access boundary.
3. Implement persistent locking, validated immutable saves, internal recovery revisions, audit and WOPI routes. Serialize existing lifecycle changes and fix touched batch URL tenant filtering.
4. Add SDK methods, reusable responsive editor and attachment action, dedicated files route and graceful disabled/unavailable fallback.
5. Add pinned optional CODE Compose service, preserve settings across both installer reruns and update bootstrap helper lists.
6. Add security/protocol/concurrency/installer tests. Validate real container discovery and available integration environments without changing the configured production database.
7. Update environment/deployment/troubleshooting documentation. Run affected tests, lint, build, React Doctor and final diff/security review; document validation limits.
