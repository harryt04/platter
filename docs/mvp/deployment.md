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

Boolean environment settings accept only the literal values `true` and `false`.
Optional integrations and hosted policy publication default to disabled when
unset; invalid boolean values fail startup rather than being silently treated
as enabled.

Administrator status does not imply access to private lists or recipes. Keep
`ADMIN_PRIVATE_CONTENT_ACCESS_ENABLED=false` unless the instance has an
operator-approved support policy. When enabled, the private-content access
boundary still requires an approved purpose and operator case reference,
issues a 15-minute grant, and writes a metadata-only audit record whose target
is represented by a fingerprint rather than a raw account identifier. No
existing moderation screen uses this boundary to gain shopping or list
authority.

Better Auth authentication and password-reset endpoints use in-memory
endpoint-specific rate limits and return a stable problem response with a
`Retry-After` header when limited. The default memory storage is process-local;
deployments running multiple web processes should place a shared rate-limiting
boundary at the reverse proxy or replace the Better Auth storage seam with a
shared implementation.

The administrator instance settings disclose the licensing, cost, and data
sharing implications of each optional integration. SMTP sends invitation and
password-reset recipients and message content to the configured provider;
PostHog receives only allowlisted, content-free events after complete opt-in;
and recipe imports fetch submitted URLs from the Platter instance without a
paid recipe API. Disabled or incomplete optional integrations remain typed
no-ops, so manual recipes, saved recipes, and shopping do not depend on them.

## Recipe import adapters

Set `RECIPE_IMPORTS_ENABLED=false` when the instance operator needs to pause
new public URL imports or source refreshes. Import history remains readable,
previously saved imported recipes remain available, and manual recipes and
shopping do not depend on this setting. The API, UI, and worker all enforce
the setting so queued work cannot fetch or publish after the pause.

Production also fails closed until the hosted public-catalog policy is
published and configured. Set `PUBLIC_CATALOG_POLICIES_PUBLISHED=true` only
after publishing the deployment's terms, privacy policy, content-removal
contact, and repeat-infringer handling, then provide their URLs/contact in
`PUBLIC_CATALOG_TERMS_URL`, `PUBLIC_CATALOG_PRIVACY_URL`,
`PUBLIC_CATALOG_REMOVAL_CONTACT`, and
`PUBLIC_CATALOG_REPEAT_INFRINGER_POLICY_URL`. Missing or malformed values keep
new public imports disabled while manual recipes, existing saved recipes, and
shopping continue to work. Local development and automated tests may exercise
the import workflow without claiming that hosted policies are published.

Operators who choose to publish an optional DMCA safe-harbor process can also
set `PUBLIC_CATALOG_DMCA_AGENT_NAME`,
`PUBLIC_CATALOG_DMCA_AGENT_CONTACT`, `PUBLIC_CATALOG_DMCA_NOTICE_URL`, and
`PUBLIC_CATALOG_DMCA_COUNTER_NOTICE_URL`. Configure all four together: the
public copyright page then shows the designated agent and links to both
processes, while the administrator instance summary reports partial
configuration without exposing secret values. These settings are optional and
do not gate public imports; operators remain responsible for determining which
processes apply to their deployment.

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

### Adapter contract, fallback order, and fixtures

The adapter boundary is intentionally narrow: `RecipeImportAdapterContent`
contains only the final URL, response content type, bounded response body, and
byte length from the SSRF-safe fetch stage. An adapter must return one of:

- a normalized candidate that is ready for review;
- a partial candidate with explicit warnings; or
- a typed failure that is isolated to the current import.

Selection is deterministic. It tries the built-in `schema-org-json-ld` adapter,
then enabled site adapters in registry order, and finally `generic-html`.
Schema.org or site-adapter failures do not bypass the fetch boundary, and a
disabled or failed adapter never blocks manual recipes, saved recipes,
discovery, or shopping. The worker reads
`RECIPE_IMPORT_DISABLED_ADAPTERS` from the process environment; changing that
setting requires restarting the worker process. The web process, realtime
process, and core shopping paths do not depend on an adapter being enabled.

The executable contract and fallback tests live in
[`tests/unit/recipe-import-adapters.test.ts`](../../tests/unit/recipe-import-adapters.test.ts);
worker-level deployment configuration and isolated-failure tests live in
[`tests/unit/recipe-import-worker.test.ts`](../../tests/unit/recipe-import-worker.test.ts).
Those tests use inline synthetic HTML and JSON-LD authored for Platter. They
copy no external recipe prose, images, or datasets, and therefore carry no
third-party license or attribution requirement. Any future external fixture
must record its source, license or permission, and attribution next to the
fixture before it is added to the test suite.

The Mongo-backed import fixture in
[`tests/integration/recipe-imports.test.ts`](../../tests/integration/recipe-imports.test.ts)
uses synthetic attribution and CC BY 4.0 image-rights metadata. It verifies
that normalization output remains visible in public discovery, immutable
version snapshots, and public reads after the source is marked unavailable;
the fixture contains no external recipe prose or image bytes.

### Bulk dataset policy

Platter does not bundle or bulk-ingest a recipe dataset by default. If a
deployment adds a bulk loader, it must pass the dataset manifest through
`assertBulkDatasetCompatible` in
[`lib/recipes/bulk-datasets.ts`](../../lib/recipes/bulk-datasets.ts) before
publishing any records. The manifest records the source URL, terms URL,
license name and URL, attribution, and the time the operator accepted those
terms. Only the explicit `commercial-compatible` rights class is accepted;
`noncommercial-only` and `unknown` data fail closed and cannot silently enter a
potentially commercial catalog. Schema.org markup or a public download URL is
not a license and cannot replace these fields.

Import normalization keeps structured ingredient facts, yield, timing, and
concise procedural steps separate from source editorial prose. Descriptions
are not copied, and instruction values over 500 characters are excluded from
the normalized candidate and surfaced as a review warning; the user can add a
shorter step manually in the review editor.
