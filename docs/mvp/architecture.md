# Platter architecture reference

This document is the implementation map for the MVP. The [product
requirements](prd.md) remains authoritative for product behavior; this page
records where the current implementation keeps each contract and invariant.
When a behavior changes, update the owning code and this reference in the same
change.

## Runtime topology

Platter is three Node processes backed by one MongoDB replica set:

```text
browser ── HTTPS/reverse proxy ── Next.js web process
                                ├─ MongoDB (native driver)
                                ├─ Socket.IO realtime process
                                └─ Agenda import worker
```

- The web process owns pages, API routes, authentication, and server-side
  authorization.
- The realtime process owns Socket.IO connections. It uses the Mongo adapter
  and re-checks the Better Auth session and current list membership when a
  list room is joined. See [`lib/realtime/application.ts`](../../lib/realtime/application.ts)
  and [`lib/realtime/rooms.ts`](../../lib/realtime/rooms.ts).
- The worker receives only bounded SSRF-safe fetch results. It never receives
  browser cookies, credentials, or an unbounded URL response. See the
  [deployment import notes](deployment.md#recipe-import-adapters).
- MongoDB must run as a replica set, including for a single-node deployment,
  because transactions and change-stream-compatible realtime behavior depend
  on that topology. Release setup runs `npm run db:indexes` and
  `npm run db:migrate`.
- Search, analytics, SMTP, and hosted public-catalog policy are optional
  integrations. Manual recipes, saved recipes, discovery through the built-in
  Mongo provider, and shopping do not require a paid or proprietary service.
  Deployment settings and fail-closed policy behavior are documented in
  [`deployment.md`](deployment.md).

## Data model and ownership

Application IDs are opaque strings at every API, browser, realtime, and worker
boundary. Mongo `ObjectId` values are not exposed to clients. Feature-owned
documents are kept in these collections:

| Collection | Responsibility and invariant |
| --- | --- |
| `lists` | List name, lifecycle status, active membership roles, owner IDs, and the pointer to the active run. A live list always has an owner; deleted lists are excluded from membership authorization. |
| `shopping_runs` | One mutable active run per list. It stores pinned selections, generated grocery items, manual additions, current-run ordering, independent `Already have` and `Purchased` state, overrides, and idempotency receipts. The unique partial active-run index enforces one active run. |
| `shopping_run_history` | Minimal immutable completion record: list, local date, completion time, completing member, and pinned recipe/version references with people counts. It never stores a final checklist. |
| `recipes` | Stable recipe identity, owner, current usable/draft state, visibility, source/provenance, and the current version pointer. Private authored content is owner-scoped unless explicitly shared or published. |
| `recipe_versions` | Immutable structured recipe facts. Selection and history references pin a version so later edits cannot rewrite prior shopping meaning. |
| `recipe_shares` / `recipe_saves` | List-scoped sharing and user-scoped library saves. Neither operation changes the source recipe or adds it to a run. |
| `recipe_imports` | User-scoped durable import jobs, status, idempotency, bounded preview data, and provenance. A preview is not public until the user saves it and review/rights gates pass. |
| `list_invitations` / `notifications` | Expiring, hashed invitation tokens and membership-only in-product notifications. Notification payloads contain no recipe or grocery content. |
| `complaints` and moderation audit collections | Public-content reports, suppression state, and metadata-only administrative audit records. Private-content access remains disabled unless explicitly configured by the operator. |
| `account_exports` / account-deletion audit | Expiring user-scoped exports and retry-stable, pseudonymous deletion audit metadata. |
| `realtime_events` / `socket.io-adapter-events` | Short-lived recovery events and cross-process Socket.IO delivery. These are transport records, not the source of shopping truth. |
| `migration_ledger` | Applied migration name, checksum, timestamps, and result. |

The primary document types and authorization filters live beside their feature
logic: [`lib/lists.ts`](../../lib/lists.ts),
[`lib/recipes/drafts.ts`](../../lib/recipes/drafts.ts),
[`lib/recipes/selections.ts`](../../lib/recipes/selections.ts), and
[`lib/shopping-run-history.ts`](../../lib/shopping-run-history.ts). Every route
validates its opaque IDs, authenticates the session, and applies the relevant
owner, member, editor, or public-visibility filter before reading or mutating
storage.

## Recipe import contract

The import pipeline has three deliberately separate stages:

1. The fetcher validates the submitted HTTP(S) URL, DNS answers, every
   redirect target, response size, duration, and content type.
2. An adapter receives only the bounded `finalUrl`, content type, body, and
   byte length defined by [`RecipeImportAdapterContent`](../../lib/recipe-import-adapters.ts).
3. The adapter returns a normalized `candidate`, a `partial` candidate with
   warnings, or a typed `failure`. Selection order is Schema.org JSON-LD,
   enabled site-specific adapters, then conservative generic HTML extraction.

Adapters are replaceable and can be disabled by ID with
`RECIPE_IMPORT_DISABLED_ADAPTERS`. A disabled or failing adapter fails only the
affected import. It cannot make manual recipes, saved recipes, discovery, or
shopping unavailable. The adapter registry and result types are defined in
[`lib/recipe-import-adapters.ts`](../../lib/recipe-import-adapters.ts), while
normalization and rights checks are covered by the tests linked from
[`deployment.md`](deployment.md#recipe-import-adapters).

Imported content is not publicly rendered merely because extraction succeeded.
It must be reviewed, usable, explicitly public, and permitted by the public
content policy. Source attribution and image rights remain separate provenance
facts; substantial editorial prose and unknown-rights images are not silently
copied.

## Grocery calculations and run boundaries

Selection stores the immutable recipe version, desired people, and a precise
scale factor (`desired people / typical people fed`). Calculations use
`decimal.js` with 40 digits of precision. Source quantities remain separate
from calculated quantities, and countable whole-unit suggestions are guidance,
not mutations of recipe facts. Missing or malformed quantities remain readable
with no fabricated amount.

[`lib/recipes/groceries.ts`](../../lib/recipes/groceries.ts) derives stable item
identities from canonicalized selection and manual-addition inputs. It keeps
incompatible dimensions and low-confidence matches separate, records every
contribution, and applies overrides only after calculation. `Already have`,
`Purchased`, category overrides, and ordering are independent current-run
state. Completion writes minimal immutable history and a clean replacement run;
none of the old run's checklist, override, pantry, or custom ordering state is
copied into the new run.

## Synchronization and offline protocol

The active run is authoritative. Each accepted mutation increments its run
revision and carries an operation ID, client ID, and optional base revision.
Receipts make retries idempotent; stale or completed-run writes are rejected
before they can reach a replacement run.

- Connected clients receive typed, content-free mutation or completion events.
  Revisions tell clients whether to apply a change or recover from the source
  snapshot; events are never treated as durable state.
- Realtime failure is best effort after the authoritative Mongo write, so a
  committed grocery action is not reported as failed just because a socket
  delivery was unavailable.
- Offline operations are stored in user-scoped Dexie state with operation ID,
  client ID, base revision, attempt count, and visible status. On reconnect,
  the latest operation for the same list/run/field wins; unrelated fields are
  retained. Old-run operations fail with an explicit completion explanation.
- Sign-out removes the account's offline records and private cache entries, so
  another account on the same device cannot see the previous user's state.

The shared mutation contract is in [`lib/contracts/mutations.ts`](../../lib/contracts/mutations.ts);
the realtime publisher is [`lib/realtime/events.ts`](../../lib/realtime/events.ts);
offline storage and reconciliation are in [`lib/offline/database.ts`](../../lib/offline/database.ts)
and [`lib/offline/sync.ts`](../../lib/offline/sync.ts).

## Privacy and security boundaries

- Better Auth sessions are required for authenticated pages, APIs, realtime
  handshakes, and worker-triggering actions. List IDs, recipe IDs, run IDs,
  history IDs, import IDs, and complaint IDs are validated as untrusted input.
- Role checks are centralized in [`lib/auth/authorization.ts`](../../lib/auth/authorization.ts)
  and [`lib/lists.ts`](../../lib/lists.ts). Administrator status does not imply
  private list or recipe access.
- User-authored text crosses the shared plain-text sanitizer before storage.
  Imported active content is never rendered as executable markup.
- Analytics is an allowlisted, content-free no-op unless explicitly enabled;
  recipe text, grocery text, URLs, contacts, and secrets are rejected from
  event properties.
- Account export and deletion are owner-scoped. Deletion removes private
  artifacts, anonymizes retained public imports according to policy, revokes
  sessions, and clears user-scoped offline state while preserving only the
  minimal references needed for legitimate history resolution.

See the [PRD security and privacy requirements](prd.md#16-security-and-privacy),
the [deployment privacy settings](deployment.md), and the focused
[`security-regression.test.ts`](../../tests/unit/security-regression.test.ts)
suite for the normative rules and regression coverage.

## Indexes, migrations, and release checks

[`lib/db/indexes.ts`](../../lib/db/indexes.ts) is the index source of truth. It
covers public weighted search, approved-import canonical URL and fingerprint
deduplication, recipe versions, list membership, invitations, notification and
export expiry, moderation/audit lookup, import pagination/idempotency, the one
active run per list, realtime recovery, and history by list/local date.

[`scripts/db/migrate.ts`](../../scripts/db/migrate.ts) applies named,
checksum-tracked migrations through `migration_ledger`. The current foundation
migration is intentionally a recorded no-op; future document transformations
must add a new migration name and remain retry-safe rather than editing old
migrations.

The contributor-facing release contract is:

```sh
npm run prettify
npm run ci
```

`npm run ci` covers formatting, lint, type checking, unit/component tests,
security regression tests, Mongo-backed integration tests, Chromium browser
tests, accessibility checks, and production builds. Service-backed checks use
the test database and the local Mongo replica set described in
[`README.md`](../../README.md).

## Traceability map

| Contract | Implementation | Verification |
| --- | --- | --- |
| Data model and authorization | `lib/lists.ts`, `lib/recipes/`, `app/api/v1/` | `tests/integration/`, security regression tests |
| Import adapter and rights boundary | `lib/recipe-import-*.ts`, `server/worker/` | `tests/unit/recipe-import-*.test.ts`, `tests/integration/recipe-imports.test.ts` |
| Deterministic grocery calculation | `lib/recipes/ingredient-parser.ts`, `scaling.ts`, `groceries.ts` | parser, scaling, grocery, and property-based unit tests |
| Connected and offline synchronization | `lib/realtime/`, `lib/offline/` | realtime unit/integration tests and offline Playwright coverage |
| Indexes and migrations | `lib/db/indexes.ts`, `scripts/db/` | integration setup and CI production checks |
| Deployment assumptions | `docs/mvp/deployment.md`, `.env.example`, `docker-compose.yml` | documented setup commands and CI service-backed suites |
