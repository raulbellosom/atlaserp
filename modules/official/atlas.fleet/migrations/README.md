# Legacy SQL Migrations (Archived)

These `V00X_*.sql` files are kept only for historical reference.

Runtime install/uninstall for `atlas.fleet` is now driven by declarative
models (`manifest.models`) and lifecycle ownership metadata, not by executing
`manifest.migrations`.

Do not add new versioned SQL migration files here for custom module evolution.
