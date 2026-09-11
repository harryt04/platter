# Platter

Platter is a mobile-first recipe-to-grocery app you can install on your device. It turns chosen recipes into one shared shopping list, shows where ingredients came from, supports recipe discovery and personal recipes, and works offline.

Offline mobile performance budgets and the repeatable Chromium profile used to
check them are documented in [the offline performance budget](docs/mvp/offline-performance-budget.md).

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
Account settings now let signed-in users prepare a private JSON export of
their profile, memberships, authored recipes, saved references, imports, and
list history. Export downloads use an owner-scoped opaque ID, never serialize
other list members, omit import idempotency keys, and expire after 24 hours.
The account panel shows locale-formatted expiry, reports preparation progress
and failures, and offers a retry without sending export content to analytics or
logs. Account settings also load a server-scoped, count-only deletion impact
summary covering owned lists, memberships, authored recipes, public imported
recipes, and completed shopping runs. Sole-owner lists include per-list links
to transfer ownership or delete the list, and an authenticated readiness check
stays blocked until every ownership boundary is resolved. Mongo-backed
integration coverage verifies owner scoping, export contents, locale
preservation, expiry, and cross-account download rejection. After ownership is
resolved, account deletion requires the account email and password, removes
private authored recipes and personal artifacts, and preserves only anonymous
unavailable version identities for active or completed-run references.
Approved public imports remain in the catalog with their source and rights
provenance, while catalog ownership is anonymized and the deleted account’s
import jobs and saved references are removed. Better Auth revokes the deleted
account’s sessions, and the client removes that account’s queued operations,
offline snapshots, remembered identity, and any reserved private Cache Storage
entries before navigating to sign-in. The destructive path records one
retry-stable, metadata-only audit entry with aggregate impact and cleanup
counts, using a pseudonymous account fingerprint rather than retaining account
identity or recipe content.
All dynamic list pages and realtime room joins now reject malformed list IDs
before authentication or storage access, matching the existing bounded ID
checks across list APIs, recipe routes, shopping history, imports, and
administrative complaint updates.
Public recipe discovery is throttled per client address, and rate-limited
search, import, report, export, and import-recovery responses share a stable
problem document with a `Retry-After` hint. Better Auth authentication and
password-reset endpoints use enabled endpoint-specific limits; their provider
429 responses are normalized to the same problem contract without exposing
provider or credential details.
Database or search-provider failures on discovery now return a stable retryable
503 without exposing backend details; saved recipes and shopping remain on
their independent boundaries.
Authenticated import status list and detail reads also validate persisted
summaries before returning them, and hide database or malformed-record failures
behind the same retryable problem contract.
Import submission and retry mutations now validate their response envelopes and
hide storage or malformed replay data behind the same retryable problem
contract.
Account export creation and owner-scoped downloads validate persisted export
envelopes and hide storage or malformed-record failures behind a stable
retryable problem response.
Administrator roles do not grant private list or recipe access by implication.
The exceptional private-content access boundary is disabled by default; when a
self-hosted operator explicitly enables it, each short-lived grant requires an
approved purpose and case reference and records a metadata-only audit entry
with a target-account fingerprint.
Administrator complaint queue and status updates validate persisted complaint
records and returned summaries, and hide database, audit, or malformed-record
failures behind stable retryable problem responses without exposing backend
details. Notification list and read-state routes validate persisted records and
hide storage or malformed-record failures behind stable retryable problems.
Owner-only list-member reads validate persisted member envelopes and hide
storage or malformed-record failures behind a stable retryable problem.
Purchased checklist mutations validate replayed and newly-created response
envelopes and hide storage or malformed-record failures behind the same stable
retryable problem contract.
Manual grocery create, update, and removal mutations apply the same response
validation and retryable storage-failure boundary, including idempotent replay
receipts.
Authenticated list collection reads and creation writes validate their
client-facing envelopes and hide storage or malformed-record failures behind
stable retryable problems.
Owner-only list lifecycle updates and deletes now use the same validated
response and retryable storage-failure boundary, without exposing malformed
persisted list records or database details.
Editor leave-list mutations now validate their returned list envelope and hide
authentication, storage, or malformed-record failures behind the same stable
retryable problem contract.
Recipe selection creation, people changes, version repinning, duplication, and
removal now validate new and replayed response envelopes and hide storage or
malformed-replay failures behind that same stable retryable problem contract.
Grocery category ordering now validates new and replayed response envelopes and
hides storage or malformed-replay failures behind that same stable retryable
problem contract.
The personal recipe-library API now validates recipe envelopes and pagination
results, passes the user's search text into the library query, and hides
storage or malformed-record failures behind the same stable retryable problem
contract.
Public recipe save and removal now validate their minimal public target and
response envelope, and hide authentication, storage, and malformed-target
failures behind the same stable retryable problem contract.
Recipe detail reads and private draft edits or deletes now validate the full
recipe envelope and hide authentication, storage, or malformed-record failures
behind that same stable retryable problem contract.
Owner-only recipe-sharing reads and updates now validate their response
envelopes and hide authentication, storage, or malformed-record failures behind
the same stable retryable problem contract.
Owner-only invitation list, create, resend, and revoke operations validate
their response envelopes and hide storage or malformed-record failures behind
the same stable retryable problem contract.
Recipient invitation inspection and connected acceptance validate their
invitation and list response envelopes and hide lookup, transaction, or
malformed-record failures behind the same stable retryable problem contract.
Shopping history reads validate their minimal persisted envelopes and hide
authentication, storage, or malformed-record failures behind the same stable
retryable problem contract.
MongoDB’s shared index setup covers weighted public discovery, approved public
canonical-URL deduplication, list membership, one active run per list, and
history lookup by list and completion date.
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
Generation canonicalizes selection and manual-addition source order before
accumulation, so equivalent retries and reordered inputs retain byte-equivalent
units, totals, and provenance.
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
User-authored and imported recipe text, list names, profile names, manual
grocery lines, complaint descriptions, and moderation reasons pass through a
shared plain-text sanitizer at their write boundaries; source HTML is never
rendered as active content.
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
Public discovery validates opaque cursors through the shared contract and
returns a stable problem response if a search provider produces an invalid
payload, without exposing provider or database details.
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
on the detail page. Unknown image rights are shown explicitly as “Unknown — not
displayed publicly”; public pages never infer reuse permission from Schema.org
metadata or public source accessibility. Anonymous readers receive an
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
them to a shopping run, then remove only their own saved reference. Completed
recipe imports now appear in the same library with an explicit imported label
and remain owner-scoped for editing.
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
warnings for review, while safe partial facts remain available. Preview-ready
imports now open an authenticated, owner-scoped manual-completion editor when
facts are missing, preserving the extracted title, ingredients, instructions,
source facts, attribution, and metadata for correction before saving to the
recipe library. A reviewed import with a positive yield and at least one
structured ingredient is approved and published to public discovery at save
time; incomplete imports remain private drafts until they are usable. The
normalizer keeps structured ingredient facts, yield, timing, and concise
procedural steps separate from source editorial prose; descriptions are not
copied, and instruction values over 500 characters are omitted with a review
warning. The import worker also records the submitted and canonical URLs,
source domain and title, source author, acquisition method and timestamp, the
Schema.org importer, a SHA-256 content fingerprint, and unknown rights status;
that provenance is copied to the immutable recipe version. Saving is safe to
retry and never adds the recipe to an active shopping run. Preview saves now
compare canonical URLs and
content fingerprints against approved public imports and link the user to an
existing public recipe instead of silently creating a duplicate. When the
canonical source has changed, the preview identifies the existing recipe and
version, requires explicit confirmation, and records the new draft as a
related source update without replacing the existing recipe. Import saves now
claim the source import and create its public recipe plus immutable version in
one transaction; a unique public fingerprint index and duplicate-key recovery
keep concurrent or retried saves from creating duplicate identities or
versions. Mongo-backed integration coverage now verifies this workflow's
deduplication, source-version coexistence, discovery visibility, private
boundaries, and complete provenance. Preview-save reads and writes also
validate persisted import records and response envelopes, with authentication,
storage, transaction, and malformed-data failures isolated behind a stable
retryable problem response.
Public copyright and removal pages explain the information needed for a
content request and state that complaint contacts stay out of public recipe
responses and general application logs. The public report form accepts a
recipe ID or source URL, report type, review description, and optional reply
contact; a process-local per-client limit protects the intake, public recipe
IDs must resolve to visible public recipes, and only a receipt containing the
complaint ID, received status, and timestamp is returned. Complaint contact
data and source details remain in the restricted complaints collection for the
administrative workflow. Administrators can now review that restricted queue
and move reports through guarded received, actioned, countered, restored, and
closed states; each change records the administrator and timestamp in complaint
history. Queue reads also create metadata-only administrator audit records
containing identifiers and status transitions, never contact details,
descriptions, or source URLs. Mongo-backed integration tests cover public
submission, validation, rate limits, restricted fields, audit transitions, and
unauthorized access. The administrator public-recipes screen also finds usable public or
suppressed records by recipe ID, source URL, domain, importer, or content
fingerprint while returning metadata only. Its response is runtime-validated
against a strict metadata schema so persisted private fields cannot cross the
administrator API boundary. The hosted policy copy also makes clear that operators must publish
the contacts and jurisdiction-specific removal or repeat-infringer processes
required for their deployment; Platter does not provide legal advice or select
those obligations.
Administrators can now record an active suppression for a public recipe, exact
source URL, content fingerprint, or source domain from the public-content finder.
Suppression reasons retain the acting administrator, timestamp, and linked audit
record; recipe targets and every matching public recipe for URL, fingerprint, or
domain targets are marked suppressed in the same Mongo transaction. Public search
and detail reads then exclude those records while retaining the recipe document
and immutable history references for private moderation and completed-run
resolution. Active target uniqueness prevents duplicate suppression records, and
the new indexes support audit review without exposing private recipe content.
Administrators can review those records on the suppression-management page and
explicitly restore one active target. Restoration is transactional and creates a
second audit record; a recipe is reopened only when no other active suppression
still matches it, and the moderation route has no list-membership or shopping
authority. Administrator public-content search also converts database failures
into a retryable problem response without exposing backend details.
Signed-in users can now view and update their display name and supported locale
from Account settings. Profile updates are validated on the server, sanitize
control characters, and keep the authentication email read-only. History dates
and supported grocery quantities use that locale for display while canonical
stored quantities and deterministic grocery calculations remain unchanged.
Account-deletion impact and readiness responses also validate their computed
account-scoped summaries at the API boundary and return retryable problem
responses when storage or summary data is unavailable or malformed.
New imports and historical reprocessing check all of those source identities
before exposing a preview, while preview saves repeat the check inside their
transaction so a suppression cannot race with public publication.
Administrator instance settings now summarize email delivery, analytics,
public-catalog policy, importer, moderation, and source-adapter status without
rendering secret configuration values. The public catalog is explicitly shown
as not ready for hosted enablement until the operator publishes the required
policies and contacts; manual recipes and existing saved recipes remain
independent of that readiness status.
Analytics events are centralized in a typed, content-free contract covering the
core recipe-to-shopping funnel, collaboration, synchronization, imports, and
history reuse. Successful shopping-run completion emits a derived recipe count
and multi-recipe signal without recording recipe identities, while idempotent
completion retries do not emit duplicate events. Unknown properties—including
recipe, ingredient, grocery, URL, complaint-contact, and secret values—are
rejected before an enabled provider can receive them; disabled or incomplete
analytics remain a typed no-op. The server and explicitly configured browser
adapters also swallow provider setup, delivery, and shutdown failures so
analytics cannot make core product actions unavailable.
The connected shopping boundary also has a real two-client performance check:
20 authenticated Socket.IO updates are timed, operation and revision delivery
is verified, failures are counted, and the 95th-percentile latency must remain
under two seconds.
Operators can pause new public URL imports and source refreshes with
`RECIPE_IMPORTS_ENABLED=false`; import history remains readable and manual
recipes, existing saved recipes, and shopping continue to work. Individual
adapters remain independently disableable with
`RECIPE_IMPORT_DISABLED_ADAPTERS`.
Production also keeps imports disabled until the operator publishes and
configures the terms, privacy, removal-contact, and repeat-infringer policies:
set `PUBLIC_CATALOG_POLICIES_PUBLISHED=true` and provide the four corresponding
`PUBLIC_CATALOG_*` URL/contact settings documented in
[`docs/mvp/deployment.md`](docs/mvp/deployment.md). Local development and
automated tests can still exercise imports without representing hosted policy
publication.
An optional DMCA process can be published by configuring all four
`PUBLIC_CATALOG_DMCA_*` settings documented in
[`docs/mvp/deployment.md`](docs/mvp/deployment.md); the public copyright page
will show the designated agent and notice/counter-notice links. Partial DMCA
configuration is reported as incomplete but does not block imports.
The import extraction stage now runs through a typed replaceable adapter
contract: bounded fetched HTML can produce a normalized candidate, a partial
candidate with warnings, or an isolated typed failure. Selection tries
Schema.org JSON-LD first, then enabled site adapters supplied by the registry,
and finally conservative generic HTML microdata/title extraction. All adapters
receive only the same bounded SSRF-safe fetch result. Operators can disable
adapter IDs with the comma-separated `RECIPE_IMPORT_DISABLED_ADAPTERS`
setting; disabled or absent adapters fail only the affected import and leave
manual recipes, saved recipes, discovery, and shopping available.
Failed imports can be retried from import history, and preview-ready
historical imports can be reprocessed through a fresh typed job generation.
Generation-aware queue claims prevent stale work from changing a newer run;
reprocessing preserves any existing saved-recipe claim, so refreshing a source
cannot create a duplicate save. When a refresh receives HTTP 404 or 410, the
source is marked unavailable without deleting or rewriting the normalized
recipe facts or provenance. Public recipe detail keeps the source link and
explains that the preserved recipe remains available; a later successful
refresh restores the available status.
Public recipe detail, discovery cards, and the signed-in recipe library resolve
source name, canonical source link, and source author from retained import
provenance when editable preview fields are omitted, so imported attribution
remains visible after normalization and source-unavailability updates.
Bulk datasets are not bundled by default. Any future bulk loader must validate
its source, terms, license, attribution, and explicit commercial-compatibility
classification through `assertBulkDatasetCompatible`; noncommercial and
unknown-rights datasets are rejected before catalog publication.
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
unrecognized ingredients remain in Other. Malformed persisted ingredient or
scale data is isolated as a readable low-confidence item with no fabricated
amount, so one normalization failure cannot take the rest of shopping down.
Active runs group categories along a
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
The mobile application shell treats navigation as a keyboard-accessible modal
surface: opening it exposes its state, moves focus into the menu, keeps Tab
within the menu, supports Escape and route-selection dismissal, and returns
focus to the trigger.
Mongo-backed list integration coverage now exercises three-list creation,
membership isolation, owner lifecycle changes, editor restrictions, and the
one-active-run database invariant; authenticated browser coverage runs when the
documented E2E test account environment variables are configured.

## Documentation

- [Product requirements](docs/mvp/prd.md) — product rules, data model, permissions, edge cases, and acceptance checks.
- [Architecture reference](docs/mvp/architecture.md) — current data model, import contract, grocery calculations, synchronization, privacy boundaries, indexes, migrations, and deployment assumptions.
- [Repository hygiene](docs/mvp/repository-hygiene.md) — tracked-content, asset, fixture-rights, and operator-policy safeguards.
- [Acceptance traceability](docs/mvp/acceptance-traceability.md) — repeatable evidence mapped to every PRD acceptance criterion.
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
| `npm run repository:check` | Check tracked content for credential markers, unreviewed raster assets, and unmarked policy templates. |
| `npm run lint` / `typecheck` | Run ESLint or TypeScript checks. |
| `npm run test` / `test:security` / `test:watch` | Run the unit/component suite, security regression suite, or watch tests. |
| `npm run test:integration` | Run integration tests against a test/CI Mongo database. |
| `npm run test:e2e` / `test:a11y` | Run the deterministic Chromium production Playwright suite or its tagged accessibility checks. Use `npx playwright test` for the full configured browser matrix. |
| `npm run db:indexes` / `db:migrate` | Reconcile indexes or apply the migration ledger. |
| `npm run check` | Format check, lint, typecheck, unit/component tests, and build. |
| `npm run ci` | Full merge-ready check: `check`, security, integration, browser, and accessibility tests. |

See [deployment notes](docs/mvp/deployment.md) for reverse proxy, MongoDB,
SMTP, analytics, and future Google OAuth guidance.

Integration tests refuse to write to a development database. For a host-side
Mongo replica set, use a test database and direct connection, for example:
`MONGODB_URI='mongodb://127.0.0.1:27017/?directConnection=true' MONGODB_DATABASE=platter_test npm run test:integration`.

`npm run ci` includes the integration and Playwright suites, so run it after
starting the documented local services and provisioning the ignored E2E
account. It uses the same production-build browser server as
`npm run test:e2e`; set `MONGODB_DATABASE` to a test or CI database when
running the full command locally.

The integration foundation suite includes a synthetic performance guard for
public discovery and normal list loads. It seeds 100 public recipes and 20
lists, measures 20 requests per surface in batches of five concurrent
requests, and requires each surface's 95th-percentile response to remain
under two seconds while returning useful content.
