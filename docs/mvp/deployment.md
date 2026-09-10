# Platter deployment notes

The foundation runs three Node processes: the Next.js web process, a separate
Socket.IO realtime process, and an Agenda worker. Put a same-origin reverse
proxy in front of the web process and route the realtime origin to the
Socket.IO port with WebSocket upgrade support. Set `APP_URL`,
`BETTER_AUTH_URL`, and `ALLOWED_ORIGINS` to the public origin.

MongoDB must be a replica set, including for a single-node deployment. Set an
explicit `MONGODB_DATABASE`; do not share the development database with tests.
Run `npm run db:indexes` and `npm run db:migrate` as part of release setup.

Set `SMTP_ENABLED=true` before configuring hosted SMTP with `SMTP_HOST`,
`SMTP_PORT`, `SMTP_FROM`, and optional credentials. Password reset and list
invitation delivery are no-ops when SMTP is disabled, and an SMTP failure does
not invalidate an already-created in-product invitation. Password reset links
must use the canonical HTTPS application URL. PostHog remains disabled unless `POSTHOG_ENABLED=true` and both public
PostHog settings are present; the adapter never sends recipe or grocery
content. Google sign-in is reserved for a later release and requires
human-created OAuth credentials and approved redirect URIs.

## Recipe import adapters

The worker passes only the bounded result of the SSRF-safe fetch stage to an
import adapter. Adapters implement the typed contract in
`lib/recipe-import-adapters.ts` and return a normalized candidate, a partial
candidate with explicit warnings, or a typed failure. Selection tries the
`schema-org-json-ld` adapter first, then enabled site-specific adapters in
registry order, and finally the conservative `generic-html` adapter. Every
adapter receives only the same bounded fetch result; a disabled or failing
adapter therefore cannot expand fetch authority or interrupt manual recipes,
saved recipes, discovery, or shopping workflows.

Operators can set `RECIPE_IMPORT_DISABLED_ADAPTERS` to a comma-separated list
of adapter IDs, such as `schema-org-json-ld` or `generic-html`. Disabled
adapters are skipped during selection; if no adapter remains, only that import
is marked failed with `ADAPTER_DISABLED`. Manual recipes, saved recipes,
discovery, and shopping continue to use their normal paths.

Import history recovery creates a fresh typed job generation for a failed
retry or a preview refresh. Queue uniqueness is scoped to that generation, and
the worker claims it before fetching. Refreshing an existing import preserves
its saved-recipe claim, so reprocessing a historical job cannot create a
duplicate recipe save.
If a refresh receives HTTP 404 or 410, the import is terminally marked with
`SOURCE_UNAVAILABLE`; the saved normalized recipe and its provenance remain
available, while the current recipe record records the source status and check
time. A later successful refresh marks the source available again.
