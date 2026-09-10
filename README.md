# Platter

Platter is a mobile-first recipe-to-grocery app you can install on your device. It turns chosen recipes into one shared shopping list, shows where ingredients came from, supports recipe discovery and personal recipes, and works offline.

## Project status

The foundation scaffold, private recipe drafts with structured yield,
ingredients, ordered instructions, timing/classification metadata, household
notes, source attribution, and image provenance, plus list management,
owner-managed active members, owner-only invitation management, and recipient
invitation acceptance, ownership-safe member leaving, and recipient invitation
acceptance with bounded invitation attempts and clear terminal or account-mismatch
outcomes are in place. Removing or leaving a list also evicts that user’s
connected realtime sockets from the list room across realtime processes. Recipe drafts also accept optional
informational nutrition values per person. Signed-in users also receive
in-product notifications for invitations and member role or removal changes,
with authenticated deep links and independent read state.
The notification contract is membership-only: purchased checks and routine
grocery edits have no supported notification event or delivery path.
Archived lists preserve read access to their shopping run while disabling
shopping changes such as completion and amount resets. Owners and editors can
now confirm an active run through an atomic transition that retains only
versioned recipe selections, people counts, completion time, local date, and
the completing member in history before creating a clean active run; checklist
state and current-run ordering are not copied forward.
Connected list members now receive a typed completion handoff that identifies
the completing member and refreshes them onto the newly created active run.
Completion retries reuse their recorded receipt even after the active-run
pointer has moved, so a dropped response cannot create a second history entry
or replacement run.
Every run mutation now carries the run identity it was created against; the
server rejects stale writes before they can reach the replacement run. Queued
offline writes for a completed run are left failed with a clear completion
message rather than being replayed against the new checklist.
List members can now browse completed shopping runs in stable date order with
locale-formatted dates; the history view says which recipes were shopped for
without implying that they were cooked or purchased. Each history entry now
opens to an authorized detail view showing its completion date, completing
member, immutable recipe versions, and people counts without retaining a final
checklist. Members can explicitly add those pinned recipe versions and people
counts to the current run again; the action is idempotent and never restores
the old checklist state. Repetition rebuilds each selection from its
allowlisted immutable version and people count, so prior ordering, purchased,
already-have, override, and pantry state cannot cross the run boundary.
Mongo-backed and authenticated browser coverage now exercises historical
version resolution, list authorization, local-date lookup, repeat behavior,
and idempotent retries.
The ingredient parser now recognizes common quantity forms, preserves source
text, records qualitative confidence and a stable normalized identity when the
parse is sufficient, resolves a bounded set of high-confidence ingredient
aliases without collapsing meaningful varieties, classifies units by dimension,
degrades incomplete lines to readable unknown ingredients without a fabricated
amount, and performs high-precision locale-aware mass and volume conversions
within a dimension while refusing to convert mass and volume without
ingredient-specific data. Cross-dimension, uncertain, and incompatible
contributions remain separate with unit and property-based regression coverage
for confidence, conversion, provenance, and contribution removal. The first
grocery-generation layer now derives stable, provenance-preserving items from
pinned selections, while remaining grocery correction, collaboration, and
moderation remain intentionally deferred
to the feature lanes described in the
[scaffolding plan](docs/mvp/scaffolding-setup-instructions.md).
Review and shopping rows now render those generated items from the active run,
including an expandable calculation breakdown for every recipe or manual
contribution and the aggregate calculated requirement. Grocery derivation also
removes orphaned recipe items while retaining manual contributions and
intentional shopping overrides with no fabricated current requirement. When
two separately generated low-confidence items have the same visible identity
and dimension, the rows expose a deterministic optional comparison suggestion
without combining their amounts. That comparison can be expanded to inspect
both item identities, dimensions, original lines, and recipe sources before a
merge correction. Members can split an incorrect combined contribution after
reviewing its source line; the correction is scoped to the active run, keeps
recipe facts unchanged, remains stable when groceries are regenerated, and
restores focus when a correction is dismissed. Uncertainty is also communicated
through explicit labels and explanatory text rather than color alone.
Ingredient corrections in a recipe require explicit confirmation, save a new
immutable recipe version, and leave existing selections pinned until a member
accepts that version.
Public recipe reads also have a shared visibility guard: imported content must
be approved after review, usable, and explicitly public before it can render.
Recipes now have stable identities and incrementing immutable version IDs;
editing or deleting a recipe snapshots the prior version for future run and
history references. Authored usable recipes remain private until the owner
explicitly shares them with selected active lists or publishes them to the
public catalog; list-scoped access is checked against current membership.
Editing a published recipe creates a private personal variant with lineage to
the published version, leaving the public source unchanged.
Household notes are personal recipe notes: the owner can edit them, but shared,
saved, and public recipe reads omit them unless the recipe is being viewed by
its owner.
Mongo-backed public discovery now applies the same usable, explicit-public, and
approved-import guard as public recipe reads; private searches require an
owner-scoped query. Public discovery now has a real anonymous and signed-in
search page and API backed by Mongo text search across recipe titles,
ingredients, source metadata, cuisines, tags, and dietary labels.
Discovery filters compose with stable rank-and-ID cursor pagination, and the
page preserves active filters while loading more results.
Public discovery selects the built-in MongoDB search provider by default, so
the core search flow remains self-hostable without a paid or proprietary
search service. Mongo-backed integration fixtures also verify weighted field
ranking, composed filters, visibility isolation, cursor stability, and a
synthetic two-second discovery-page target.
Discovery ranking combines Mongo's weighted title and ingredient relevance with
deterministic completeness signals and a capped count of public saves, while
retaining stable ID tie-breaking and visible source attribution.
Discovery cards show permitted recipe images, source links, typical yield,
concise summaries, and explicit source attribution when supplied. Public recipe
detail pages now read through the same approved-import and public-visibility
guard, render the saved ingredient and direction data, and preserve source,
version, attribution, and image-rights context. Ingredient quantities and
recipe provenance use the documented data typography and remain visibly labeled
on the detail page. Anonymous readers receive an
explicit sign-in handoff on the detail page before saving or adding a recipe to
a list, with the recipe URL preserved through authentication.
Suppressed, draft, and list-shared recipe versions remain available through
authorized private management paths but are excluded from public detail reads,
anonymous rendering, and public discovery.
Shopping-run recipe references can resolve immutable historical snapshots by
version identity, preserving selection order and duplicates without falling
back to a later mutable recipe version.
Mongo-backed integration coverage now verifies private, list-shared, and public
visibility boundaries alongside historical version resolution.
List owners and editors can now add an accessible usable recipe to an active
shopping run for a positive whole-person count. Each selection stores its
immutable recipe version and a high-precision desired-to-typical scale factor;
public recipe details expose the list and serving-count action for signed-in
members. Selection responses also expose precise calculated ingredient
quantities, retain each source quantity, keep whole-count suggestions as
separate shopping guidance, and show missing quantities as `As needed` with
explicit optional labels in the selection confirmation. The add action is
explicitly separate from saving a public recipe, and the serving examples are
covered for four-to-two (`0.5`) and four-to-six (`1.5`) scaling in unit and
credential-gated browser tests.
The signed-in recipe library now combines authored recipes with usable recipes
shared through the member's current lists, and shared entries remain read-only.
Signed-in users can also save public recipes to that library without adding
them to a shopping run, then remove only their own saved reference.
Signed-in users can now submit public HTTP(S) recipe URLs into a durable,
owner-scoped import queue. Each submission carries a bounded per-user
`Idempotency-Key`; retried requests reuse the original import and Agenda job,
while the job stores only the import owner, import ID, and idempotency key.
Import submission and status reads are authenticated and rate-limited per user;
a queue outage marks only the import as failed and does not cross into saved
recipes, discovery, or shopping. The connected import screen shows queued,
processing, retrying, failed, and preview-ready status vocabulary and never
queues URL work while offline. The worker now fetches sources through an SSRF-safe
HTTP(S) boundary: every hostname is resolved before connecting and again after
redirects, resolved private or reserved addresses are rejected, requests are
pinned to the validated address without user credentials, and HTML responses
are bounded to 2 MiB, five redirects, and ten seconds. Unsupported content,
unsafe redirects, and oversized responses become isolated import failures;
transient DNS, timeout, and upstream failures retry with bounded exponential
backoff before becoming terminal. Fetched content is held only for the later
extraction and review stage; it is never treated as approved or public by the
fetch stage. The first extraction stage now recognizes Schema.org `Recipe`
JSON-LD without executing source markup and maps bounded title, yield,
ingredients, instructions, timing, classification, and source-attribution facts
into the structured editor candidate shape; missing fields remain explicit
warnings for review. Preview-ready imports now open an authenticated,
owner-scoped editor where title, yield, ingredient structure, ordered
instructions, source facts, attribution, and extracted metadata can be
corrected before saving a private imported draft. Saving preserves the imported
origin and pending review state, is safe to retry, and never adds the recipe to
an active shopping run.
List members can change the desired people for an active recipe selection from
the list page; the server recalculates its precise scale from the pinned
immutable version and advances the active-run revision without touching other
selections. They can also explicitly duplicate a selection, preserving its
pinned version and scale while creating a separately scalable selection
identity. Removing a selection requires confirmation that names the affected
list-wide grocery contributions, then removes only that selection and advances
the active-run revision. When a selected recipe has a newer accessible version,
the list keeps the existing selection pinned, links to the recipe for review,
and requires an explicit acceptance before repinning that selection; the
desired people count is preserved and the active-run revision advances.
Selection mutations carry client operation metadata, reject stale active-run
revisions, and record a run-scoped receipt so a retried create, update,
duplicate, remove, or repin replays its original result without applying the
change twice.
List owners and editors can also add, edit, and remove manual grocery items from
the review and shopping views. Manual lines are parsed into the same safe
ingredient facts as recipe lines, persist on the active run with revision-aware
retry receipts, and remain labeled as independent manual contributions without
changing any recipe or immutable recipe version.
Members can also set a precise shopping amount for a generated grocery item
without changing its calculated requirement or contribution breakdown. The
override is stored on the active run, scoped to the current list membership,
and uses the same revision and retry protections as other shared grocery edits.
The review and shopping views show both amounts and offer a one-action reset
back to the current calculated requirement only while an override exists. If a
serving, recipe-version, or contribution change recalculates the requirement,
the explicit shopping intent remains and the row calls out both the previous
calculation and the new one for review.
Countable grocery requirements that calculate to a fraction also show optional
whole-unit guidance. Shoppers can copy that suggestion into the editable
shopping amount field, while the precise calculated requirement remains visible
and unchanged until they explicitly save an override.
Every derived grocery item now receives a conservative documented default
category such as Produce, Pantry, or Household; uncertain parser output and
unrecognized ingredients remain in Other. Active runs group categories along a
documented typical-store route and use normalized ingredient names plus stable
item IDs for a predictable order within each category. Current members can
move an item to a more useful category from either active-run view; the
revision-aware, retry-safe correction is shared with the list and does not
change its recipe facts or calculated amount. The `Review at home`
mode now shows calculated and shopping amounts, category, and contribution
access for each grocery item. Members can mark an item
`Already have` without creating pantry inventory; it is hidden from the buy
view and can be restored with its existing override and provenance intact. The
review and shopping modes remain directly linked after shopping starts, with
touch-safe narrow layouts and live state feedback for `Already have` changes.
The shopping checklist now also keeps `Purchased` separate from `Already have`,
records which member marked the item, and supports retry-safe check and uncheck
actions from both shopping and review modes. Its categorized rows expose amount,
ingredient, state, category, and contribution access as a narrow-screen-safe
semantic list with touch-safe controls. Checklist reads are scoped to current
active list membership: owners and editors can open the run, while anonymous
visitors are sent to sign in and non-members receive a not-found response.
Accepted checklist and shared grocery mutations now advance the active-run
revision and publish content-free typed events with the list, run, operation,
actor, and authoritative revision. Event delivery is best effort after the
database write; the active run remains the source of truth. Connected list,
review, and shopping views join the authorized list room and refresh when a
newer matching active-run event arrives, so another shopper's accepted change
is reflected without manual reload. Events are content-free invalidation hints:
duplicate or out-of-order revisions are ignored, revision gaps trigger a
coalesced server snapshot refresh, and the live-update status clears only after
the refreshed run reports its authoritative revision. Realtime
handshakes and every list-room join revalidate the Better Auth session before
checking current list membership, so a known list ID cannot grant access.
Remote mutation batches are announced through a polite, actor-aware live region
with action categories and counts, while the originating shopper's own events
remain silent to avoid duplicate announcements.
Real Socket.IO multi-client coverage also verifies different-item and same-item
fan-out, disconnection gaps, and room rejection after membership removal or
for a non-member.
After a connected list, review, or shopping load, Platter stores a minimal
user-scoped shell and active-run summary in Dexie. The production service
worker keeps the offline route and static application assets available without
putting private HTML or API responses in Cache Storage; the offline route reads
the saved list names, recipe selections, revision, and grocery-item count from
the authenticated user's local database. The offline route requires the current
authenticated account to match the database owner, and signing out deletes
that local database and its remembered account marker before public navigation.
While offline, Purchased, Already have, and shopping-amount changes now give
immediate local feedback and are recorded as retry-safe operations in that same
user-scoped database with client, revision, attempt, and lifecycle metadata.
The offline view keeps each operation's pending, syncing, failed, or synced
state visible without exposing its private payload. Reconnection reconciliation
now drains the durable queue when connectivity returns, coalesces stale changes
to the same field, advances revisions for unrelated changes, and refreshes the
authoritative shared run. Permission loss, unavailable items, and connection
failures remain visible as operation-specific attention messages.
Invitation acceptance and URL recipe imports explicitly require a connection;
unsupported work is not presented as queued offline.
The active run also shares a temporary within-category item order: members can
use accessible move-up and move-down controls, while a newly created run begins
at the documented default order. Members can also drag a category or use its
equivalent move buttons to share a temporary store route for the current run;
the route is revision-aware and resets for the next run.
The library can search titles, ingredients, source metadata, and tags with
stable cursor pagination while preserving the same ownership, membership, and
saved-reference boundaries. Deleting a recipe explains current list impact,
removes its owner-scoped share records, and preserves the pinned immutable
version for shopping or history references.
Mongo-backed list integration coverage now exercises three-list creation,
membership isolation, owner lifecycle changes, editor restrictions, and the
one-active-run database invariant; authenticated browser coverage runs when the
documented E2E test account environment variables are configured.

## Documentation

- [Product requirements](docs/mvp/prd.md) — product rules, data model, permissions, edge cases, and acceptance checks.
- [Scaffolding setup instructions](docs/mvp/scaffolding-setup-instructions.md) — foundation architecture, setup phases, placeholder routes, verification, and parallel-agent ownership.
- [Design system](docs/DESIGN.md) — visual style, colors, app layout, screen sizes, accessibility, and motion.
- [UI implementation guide](docs/mvp/ui-implementation-guide.md) — UI work steps, component rules, and states.
- [Copy and content guidelines](docs/mvp/copy-and-content-guidelines.md) — vocabulary, action labels, trust copy, and error states.
- [Application intentions](docs/mvp/application-intentions.md) — the original product brief.

## Planned technology

The planned app will use Next.js 16 App Router with TypeScript, React Server Components, Tailwind CSS, shadcn/ui, Better Auth, and MongoDB’s native driver. Platter will be FOSS under the MIT license and support self-hosting without paid or closed services for its core features.

## Product principles

- Show recipe calculations and how each ingredient got on the list.
- Keep `Already have` distinct from `Purchased`.
- Design for phones first, with keyboard access and light and dark themes.
- Credit recipe sources and follow the licenses for imported recipes, images, and datasets.

## Local setup

Requirements: Node 24.x, npm, and Docker Compose.

```sh
cp .env.example .env.local
# Set BETTER_AUTH_SECRET to a random value of at least 16 characters.
npm install
npm run services:up
npm run db:indexes
npm run db:migrate
npm run dev
```

The standalone realtime, worker, and database scripts load `.env.local` and
`.env` with the same precedence as Next.js. The local Mongo URI uses a direct
connection because Docker Compose advertises the replica-set member name to
containers, while host-run Node processes need the published loopback port.

The web app runs on `http://localhost:3000`, Socket.IO on port `3001`, and the
Mailpit inbox on `http://localhost:8025`. `npm run services:down` stops services
without removing the Mongo volume. Password reset mail is delivered to
Mailpit locally.

Set `SMTP_ENABLED=true` to deliver password-reset and invitation emails through
the configured SMTP server; the example configuration targets local Mailpit.

For the ignored local browser account, set `E2E_USER_NAME`, `E2E_USER_EMAIL`,
and `E2E_USER_PASSWORD` in `.env` or `.env.local`, then run
`npm run db:seed:test-user`. Future agents can read the local values from
`.env`; a fresh clone will not contain them and must be provisioned locally.
The seed never prints the password.

Public recipe detail browser coverage also runs when `E2E_PUBLIC_RECIPE_ID` is
set to a public usable recipe. Set `E2E_PUBLIC_RECIPE_UNAVAILABLE_IMAGE_ID`
and `E2E_PUBLIC_RECIPE_MINIMAL_ID` to exercise the unavailable-image and
missing-optional-metadata states.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Web, realtime, and worker development processes. |
| `npm run dev:web` | Next.js development server only. |
| `npm run build` | Production web build and auxiliary-process bundles. |
| `npm run start:web` | Start the production web build. |
| `npm run start:realtime` / `start:worker` | Start bundled auxiliary processes. |
| `npm run format` / `format:check` | Write or check Prettier formatting. |
| `npm run lint` / `typecheck` | Run ESLint or TypeScript checks. |
| `npm run test` / `test:watch` | Run or watch unit/component tests. |
| `npm run test:integration` | Run integration tests against a test/CI Mongo database. |
| `npm run test:e2e` / `test:a11y` | Run production Playwright or tagged accessibility tests. |
| `npm run db:indexes` / `db:migrate` | Reconcile indexes or apply the migration ledger. |
| `npm run check` | Format check, lint, typecheck, tests, and build. |
| `npm run ci` | Alias for the merge-ready local check. |

See [deployment notes](docs/mvp/deployment.md) for reverse proxy, MongoDB,
SMTP, analytics, and future Google OAuth guidance.

Integration tests refuse to write to a development database. For a host-side
Mongo replica set, use a test database and direct connection, for example:
`MONGODB_URI='mongodb://127.0.0.1:27017/?directConnection=true' MONGODB_DATABASE=platter_test npm run test:integration`.
