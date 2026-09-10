# Platter MVP backlog

**Status:** Ready for implementation after the scaffold acceptance gate passes

**Product scope:** [Platter MVP PRD](prd.md)

**Foundation prerequisite:**
[Platter scaffolding setup instructions](scaffolding-setup-instructions.md)

This backlog turns the PRD into dependency-aware tracer-bullet tickets. Each
ticket should deliver a narrow, demonstrable path through persistence, domain
logic, authorization, API or server boundary, user interface, and relevant
automated tests. The PRD remains authoritative if a ticket omits detail or the
documents conflict.

Tickets are numbered in dependency order. A ticket may begin only after every
ticket in its **Blocked by** field is complete. Initially, the implementation
frontier is **01** and **05**. Teams may work the later frontier in parallel as
its blocking edges clear.

Every ticket must also:

- preserve the final URLs and shared contracts established by the scaffold;
- follow [DESIGN.md](../DESIGN.md), the
  [UI implementation guide](ui-implementation-guide.md), and the
  [copy and content guidelines](copy-and-content-guidelines.md) for user-facing
  work;
- enforce authorization and validate trust boundaries on the server;
- use synthetic or redistribution-compatible fixtures with recorded source
  rights and attribution;
- cover default, loading, empty, validation, error, responsive, dark-mode,
  keyboard, and offline states when relevant; and
- leave formatting, linting, type checking, tests, and production builds green.

## 01: Create and manage lists

**What to build:** Give signed-in users persistent collaboration spaces that
they can create and manage without exposing one list to members of another.

**Blocked by:** None (can start immediately)

**Status:** in progress

- [x] A signed-in user can create any number of differently named lists and see
      only lists to which they belong.
- [x] Each new list has at least one owner and exactly one empty active shopping
      run, created atomically.
- [x] An authorized owner can rename a list. Archive, unarchive, and delete a
      list with
      confirmation that names the shared impact.
- [x] An editor can leave a list without gaining access to any other list.
- [ ] An archived or deleted list rejects new shopping operations.
- [x] List IDs are treated as untrusted, and server-side authorization prevents
      access leakage between independently shared lists.
- [ ] Integration and browser tests cover creation of three lists, lifecycle
      changes, permissions, and active-run uniqueness.

## 02: Invite users to a list

**What to build:** Let owners invite another person into one specific list and
let the recipient understand and accept that invitation safely.

**Blocked by:** 01: Create and manage lists

**Status:** in progress

- [x] An owner can inspect, resend, and revoke an invitation for a specific
      list; editors and non-members cannot.
- [x] Invitation tokens are unguessable, stored safely, scoped to one list, and
      expire after the configured period.
- [x] A recipient can view an invitation summary, authenticate if needed, and
      accept a valid invitation while connected.
- [ ] Expired, revoked, already-used, malformed, and cross-account invitations
      return clear, non-leaking outcomes.
- [x] Invitation creation and acceptance are rate-limited and covered by
      integration and browser tests.

## 03: Manage list membership and ownership

**What to build:** Give list owners complete, safe control over members and
ownership while preserving the rule that every live list has an owner.

**Blocked by:** 02: Invite users to a list

**Status:** in progress

- [x] Owners can list members, remove editors, promote an editor to owner, and
      distinguish pending invitations from active membership.
- [x] Editors can use shopping features but cannot invite, remove, promote,
      rename, archive, or delete.
- [x] The last owner cannot leave, demote themselves, or be removed until
      ownership is transferred or the list is explicitly deleted.
- [ ] A removed member immediately loses API, page, realtime-room, and future
      mutation authorization for that list.
- [x] Realtime room joins verify the caller's current active membership before
      joining a list-scoped room; removed and non-member users are rejected.
- [x] Role enforcement is centralized through the established list-role helper
      and covered for every role boundary.

## 04: Notify users about membership changes

**What to build:** Keep users informed about invitations and consequential
membership changes without turning grocery activity into notification noise.

**Blocked by:** 02: Invite users to a list; 03: Manage list membership and
ownership

**Status:** in progress

- [x] A signed-in user receives an in-product notification for a new invitation
      and material membership or ownership changes affecting them.
- [x] Notifications link to the relevant list or invitation and can be marked
      read without changing the underlying membership state.
- [x] Email invitations are sent only when email delivery is configured, and a
      delivery failure does not invalidate an in-product invitation.
- [ ] Purchased checks and routine grocery edits never generate email or push
      notifications.
- [ ] Notification payloads contain no recipe or grocery content and respect
      list-scoped authorization.

## 05: Create and save recipe drafts

**What to build:** Let a signed-in user capture a private recipe idea with only
a title and safely return to it later.

**Blocked by:** None (can start immediately)

**Status:** implemented

- [x] A signed-in user can create, view, rename, and delete their own private
      recipe draft.
- [x] A title is sufficient to save a draft, but a draft cannot be added to a
      shopping run or exposed through public discovery.
- [x] Other users cannot read or mutate the draft merely by knowing its ID.
- [x] Deletion uses a named confirmation and returns focus appropriately.
- [x] Persistence, authorization, validation, empty-state, and mobile editor
      behavior have automated coverage.

## 06: Edit complete structured recipes

**What to build:** Turn a draft into a trustworthy structured recipe through a
mobile-friendly editor and make its usable state explicit.

**Blocked by:** 05: Create and save recipe drafts

**Status:** in progress

- [x] The editor supports title, description, typical people fed, ordered
      ingredients, ordered instructions, times, cuisine, meal type, tags,
      dietary labels, household notes, source, attribution, image provenance,
      and optional nutrition data.
- [x] Private drafts support a sanitized source name, HTTP(S) source link,
      source author, and attribution.
- [x] Private drafts support an HTTP(S) image with sanitized accessibility and
      provenance metadata, including source, creator, license or permission,
      and an explicit rights status.
- [x] Household notes are optional, private, sanitized, length-bounded,
      persisted, editable, and removable.
- [x] Recipe timing and classification metadata (prep, cooking, and total
      minutes, cuisine, meal type, tags, and dietary labels) is validated,
      sanitized, persisted, editable, and removable.
- [x] Optional recipe descriptions are sanitized, length-bounded, persisted,
      editable, and removable without changing recipe usability.
- [x] Each ingredient supports original text, quantity, unit, ingredient name,
      preparation note, and optional flag.
- [x] A recipe becomes usable only with a positive valid typical yield and at
      least one structured ingredient; invalid or zero yield leaves it a draft.
- [x] Ordered fields can be added, edited, removed, and reordered with pointer
      and keyboard-accessible controls.
- [x] User-authored recipe content is validated and sanitized at the recipe
      boundary, and rendered as text rather than interpreted markup.
- [ ] Active imported content is never rendered before the importer has
      completed its review and visibility checks.
- [x] Tests cover partial saves, validation recovery, ordering, and the
      draft-to-usable transition.

## 07: Parse and correct ingredient lines

**What to build:** Convert human ingredient lines into useful structured facts
without losing their original wording or pretending uncertain data is exact.

**Blocked by:** 06: Edit complete structured recipes

**Status:** ready-for-agent

- [ ] Parsing tolerates common fractions, Unicode fractions, ranges, missing
      quantities, package sizes, preparation notes, and optional ingredients.
- [ ] Parsed units distinguish count, mass, volume, and unknown dimensions;
      conversions are locale-aware and deterministic.
- [ ] The original line, parser confidence, and normalized identity are
      preserved alongside user corrections on the recipe version.
- [ ] Aliases can resolve canonical ingredients while meaningful distinctions,
      such as yellow onion and red onion, remain separate when they affect
      shopping intent.
- [ ] A parsing failure produces a separate readable ingredient rather than
      blocking recipe use or fabricating an amount.
- [ ] Table-driven and property-based tests cover supported forms, precision,
      deterministic conversion, and failure degradation.

## 08: Version recipes and control visibility

**What to build:** Preserve immutable recipe meaning over time while allowing a
creator to decide who may discover or use each recipe.

**Blocked by:** 01: Create and manage lists; 06: Edit complete structured recipes

**Status:** ready-for-agent

- [ ] Recipes have stable identities and immutable version identities, and
      edits never silently rewrite a version used by another person or run.
- [ ] Manually authored recipes remain private by default and can be shared
      with selected lists or explicitly published.
- [ ] Editing public content creates a new version or private personal variant
      with a visible relationship to its source version.
- [ ] Private, list-shared, public, draft, usable, and suppressed rules are
      independently enforced on reads, writes, and search results.
- [ ] Active and completed runs can resolve pinned historical versions even
      after later edits or permitted deletion.
- [ ] Integration tests cover public/private/shared visibility and immutable
      version references.

## 09: Manage the personal recipe library

**What to build:** Give each signed-in user one searchable place for recipes
they authored, imported, saved, or received through a list.

**Blocked by:** 08: Version recipes and control visibility

**Status:** ready-for-agent

- [ ] The library contains authored recipes, user imports, explicitly saved
      public recipes, and recipes shared through a current list membership.
- [ ] A user can save a public recipe without adding it to a run and later
      remove that saved reference without deleting public or other-user data.
- [ ] Library search supports title, ingredient, source, and tag with stable
      cursor pagination.
- [ ] Personal notes and variants stay private unless separately shared or
      published.
- [ ] Deleting a referenced private recipe explains the impact and preserves an
      immutable minimal snapshot required by list or history references.

## 10: Browse public recipes

**What to build:** Let anyone find useful public recipes through self-hostable
search while keeping source attribution and visibility rules intact.

**Blocked by:** 08: Version recipes and control visibility

**Status:** ready-for-agent

- [ ] Public visitors and signed-in users can browse and search public recipes
      by title, ingredient, source, cuisine, tag, and dietary label when present.
- [ ] Results show title, permitted image, source, typical yield, and concise
      summary metadata with visible attribution.
- [ ] Ranking favors title and ingredient matches, completeness, and allowed
      engagement signals without hiding or outweighing source identity.
- [ ] Filters compose with stable cursor pagination or progressive loading and
      never return private, shared-only, draft, or suppressed recipes.
- [ ] Search remains functional through the base Mongo provider with no paid or
      proprietary service configured.
- [ ] Integration and performance fixtures verify field weights, filters,
      visibility, pagination stability, and the two-second load target.

## 11: View a public recipe

**What to build:** Present a public recipe as an attributed, versioned cooking
resource and provide signed-in users a clear path to save or use it.

**Blocked by:** 10: Browse public recipes

**Status:** ready-for-agent

- [ ] The detail view shows title, permitted imagery, typical yield,
      ingredients, directions, source link, attribution, version, and available
      rights or license information.
- [ ] Ingredient quantities use the documented data typography, and provenance
      is visible without a hover-only interaction.
- [ ] Anonymous visitors can read public recipes but are directed to sign in
      before saving or adding one to a list.
- [ ] Suppressed and non-public versions do not render publicly, while an
      authorized owner can still access permitted private management paths.
- [ ] Mobile, desktop, loading, unavailable-image, and missing-optional-metadata
      states have browser and accessibility coverage.

## 12: Select and scale one recipe

**What to build:** Let a list member add a usable recipe version for a chosen
number of people and immediately see correctly scaled grocery requirements.

**Blocked by:** 01: Create and manage lists; 07: Parse and correct ingredient
lines; 08: Version recipes and control visibility

**Status:** ready-for-agent

- [ ] An owner or editor can select an accessible usable recipe for a positive
      whole number of people; invalid values and drafts are rejected.
- [ ] The selection pins an immutable recipe version and computes scale as
      desired people divided by typical people fed.
- [ ] Decimal calculations retain sufficient precision and do not accumulate
      friendly-display rounding; count suggestions never alter source facts.
- [ ] Ingredients with no quantity remain readable contributions without a
      fabricated amount, and optional ingredients remain visibly optional.
- [ ] Selecting a recipe never happens as a side effect of saving or importing
      it.
- [ ] Unit and browser tests demonstrate the PRD's four-to-two and four-to-six
      scaling examples.

## 13: Manage recipe selections

**What to build:** Let members deliberately change which immutable recipe
versions the active run represents without surprising collaborators.

**Blocked by:** 12: Select and scale one recipe

**Status:** ready-for-agent

- [ ] Changing desired people recalculates every contribution from only that
      selection.
- [ ] Adding the same recipe again requires an explicit duplicate action and
      produces an independently scalable and removable selection.
- [ ] Removing a selection requires confirmation that names its list-wide
      grocery impact and removes only that selection's contributions.
- [ ] A recipe update leaves existing selections pinned until a member reviews
      and explicitly accepts the newer version.
- [ ] Concurrent or repeated selection mutations are idempotent and respect the
      list's active-run revision.
- [ ] Property tests prove that changing or removing one selection cannot alter
      another selection's contributions.

## 14: Combine compatible grocery contributions

**What to build:** Derive one explainable grocery list from multiple recipe
selections while merging only facts that are safe to combine.

**Blocked by:** 13: Manage recipe selections

**Status:** ready-for-agent

- [ ] Grocery generation is deterministic for identical recipe versions,
      people counts, manual additions, and overrides.
- [ ] High-confidence matches with compatible dimensions convert to a common
      calculation unit and merge without losing decimal precision.
- [ ] Mass and volume do not convert without ingredient-specific data, and
      uncertain identities or incompatible units remain separate.
- [ ] Each item exposes its calculated requirement and a readable breakdown of
      the amount contributed by every selection.
- [ ] Removing the last recipe contribution removes the item unless an
      intentional manual addition or preserved override still requires it.
- [ ] Unit and property tests cover merge confidence, conversion, provenance,
      and contribution-removal invariants.

## 15: Correct grocery merges

**What to build:** Let a member correct ingredient-matching uncertainty without
editing the underlying recipes accidentally.

**Blocked by:** 14: Combine compatible grocery contributions

**Status:** ready-for-agent

- [ ] Low-confidence candidates remain separate and may appear as clearly
      optional merge suggestions.
- [ ] A user can inspect the identities, dimensions, original lines, and recipe
      contributions involved before accepting a merge.
- [ ] A user can split an incorrect merge and the corrected structure remains
      stable through deterministic regeneration of the current run.
- [ ] Recipe-level parser corrections require explicit confirmation and create
      or select the appropriate version before derived lists change.
- [ ] Merge, split, correction, focus restoration, and non-color uncertainty
      states have automated coverage.

## 16: Manage manual grocery items

**What to build:** Let list members add practical shopping needs that are not
part of a recipe while preserving their independent provenance.

**Blocked by:** 14: Combine compatible grocery contributions

**Status:** ready-for-agent

- [ ] An owner or editor can add, edit, and remove a manual grocery contribution
      without changing a recipe or recipe version.
- [ ] A manual contribution participates in safe aggregation and is labeled in
      the contribution breakdown.
- [ ] Removing a selected recipe preserves unrelated recipe contributions,
      manual additions, and intentional item state.
- [ ] Repeated or retried creation with the same operation ID cannot duplicate
      a manual item.
- [ ] Validation, authorization, optimistic feedback, and contribution-removal
      behavior have integration and browser coverage.

## 17: Override shopping amounts

**What to build:** Let users adapt a calculated requirement to what they
actually intend to buy without corrupting recipe math.

**Blocked by:** 13: Manage recipe selections; 16: Manage manual grocery items

**Status:** ready-for-agent

- [ ] A member can replace the shopping amount with a smaller or larger amount
      while the calculated requirement and contributions remain unchanged.
- [ ] The UI displays both values and offers a one-action reset only while an
      override exists.
- [ ] Serving, recipe-version, or contribution changes preserve an explicit
      override and warn with both the old intent and new calculated requirement.
- [ ] Optional package-size or whole-unit suggestions are editable guidance and
      are never represented as guaranteed facts.
- [ ] Tests cover override persistence, reset, recalculation, decimal precision,
      and removal of unrelated contributions.

## 18: Review groceries at home

**What to build:** Provide a focused pre-store pass for removing items already
on hand without creating a pantry inventory system.

**Blocked by:** 17: Override shopping amounts

**Status:** ready-for-agent

- [ ] The active run has a clear `Review at home` mode showing shopping amount,
      calculated requirement, category, and contribution access.
- [ ] `Already have` is an all-or-nothing item state that removes the item from
      the buy view without marking it purchased or storing a pantry quantity.
- [ ] Undo restores the item with its prior override and provenance intact.
- [ ] Partial on-hand quantities are handled through a shopping-amount override
      rather than a pantry prompt.
- [ ] An all-already-have run keeps its recipe selections and explains why the
      buy view is empty.
- [ ] The review remains available after shopping starts and works at 320px with
      one-tap controls and accessible announcements.

## 19: Categorize and reorder the current run

**What to build:** Arrange each active run into a predictable store-friendly
order while allowing that list's members to adapt it temporarily.

**Blocked by:** 15: Correct grocery merges; 16: Manage manual grocery items

**Status:** ready-for-agent

- [ ] Every grocery item receives a documented default category, with uncertain
      or uncategorized items placed in `Other`.
- [ ] Categories use the default store-adjacency order and items use a stable
      deterministic order within each category.
- [ ] Members can recategorize items and reorder categories or items for the
      current run using pointer, keyboard, and button-based controls.
- [ ] Custom ordering is shared within the list but never copied into the next
      active run.
- [ ] Ordering mutations are revision-aware, idempotent, and tested for
      accessibility and concurrent edits.

## 20: Shop with the active checklist

**What to build:** Give every list member a fast, readable checklist for buying
the current run's groceries.

**Blocked by:** 18: Review groceries at home; 19: Categorize and reorder the
current run

**Status:** ready-for-agent

- [ ] All current list members can open the categorized checklist, while
      non-members and public visitors cannot.
- [ ] A one-tap check or uncheck updates `Purchased` independently of `Already
      have` and records the acting member.
- [ ] Repeating the same check is idempotent and does not create a conflicting
      state or duplicate audit metadata.
- [ ] Each row keeps amount, unit, ingredient, state, category, and contribution
      access legible without horizontal scrolling at 320px.
- [ ] State is communicated by control state, text, and icon or position rather
      than color alone, with at least 44px interaction targets.
- [ ] Browser tests cover review-to-shopping transition, checking, unchecking,
      contribution detail, and one-handed mobile use.

## 21: Synchronize connected shoppers

**What to build:** Keep authorized shoppers on the same authoritative run while
they edit different or identical items from separate connected devices.

**Blocked by:** 03: Manage list membership and ownership; 20: Shop with the
active checklist

**Status:** ready-for-agent

- [ ] Every accepted check, uncheck, amount edit, addition, removal, and ordering
      mutation advances an authoritative run revision and emits a typed event.
- [ ] Realtime handshakes and every room join authenticate the session and
      authorize current membership; knowing a list ID grants no access.
- [ ] A second connected client reflects accepted changes within two seconds at
      the 95th percentile under the expected test load.
- [ ] Missed, duplicate, and out-of-order events cause snapshot or delta recovery
      rather than treating events as durable state.
- [ ] Screen readers receive useful batched announcements of remote changes
      without being overwhelmed.
- [ ] Multi-client tests cover different-item changes, same-item changes,
      disconnection gaps, removed membership, and non-member room rejection.

## 22: Support offline shopping and reconciliation

**What to build:** Keep the last-loaded shopping run useful in poor reception
and synchronize it honestly and safely when connectivity returns.

**Blocked by:** 21: Synchronize connected shoppers

**Status:** ready-for-agent

- [ ] After a connected load, the active-list shell, latest run, and recipe
      selection summary remain available offline to the same authenticated user.
- [ ] Offline users can check or uncheck, mark or undo `Already have`, and adjust
      shopping amounts with immediate local feedback.
- [ ] Each queued operation has a unique operation ID, client ID, base revision,
      attempt count, and visible pending, syncing, failed, or synced state.
- [ ] Retries cannot duplicate manual additions or lose unrelated item changes;
      the latest server-accepted operation wins for the same field.
- [ ] Reconciliation visibly replaces optimistic state with authoritative state
      and explains permission loss or a change made while offline.
- [ ] Invitations and URL imports explain that connectivity is required instead
      of pretending to queue unsupported work.
- [ ] Sign-out cleanup prevents another account from seeing the previous user's
      private snapshot, operations, or cached content on a shared device.

## 23: Complete a shopping run atomically

**What to build:** Let an owner or editor close the current shopping effort and
immediately start a clean one without turning the checklist into permanent
purchase history.

**Blocked by:** 20: Shop with the active checklist

**Status:** ready-for-agent

- [ ] An owner or editor can confirm completion; viewers, non-members, archived
      lists, and deleted lists cannot complete or mutate a run.
- [ ] Completion atomically makes the old run immutable and creates exactly one
      new empty active run for the list.
- [ ] Retained history contains only list, completion timestamp and local date,
      completing member, immutable recipe-version references, and desired people.
- [ ] Final grocery items, contributions, purchased states, already-have states,
      overrides, pantry facts, and custom ordering are not retained as product
      history or copied into the next run.
- [ ] Concurrent and repeated completion requests are idempotent and cannot
      create multiple active runs.
- [ ] Integration tests cover transaction failure, retry, old-run rejection,
      exact retention, and new-run emptiness.

## 24: Synchronize run completion across devices

**What to build:** Move every shopper safely off a run completed elsewhere,
including a shopper who reconnects after continuing locally.

**Blocked by:** 21: Synchronize connected shoppers; 22: Support offline shopping
and reconciliation; 23: Complete a shopping run atomically

**Status:** ready-for-agent

- [ ] Connected clients promptly receive completion and open or offer the new
      active run with the completing member identified.
- [ ] The server rejects all later writes to the completed run, regardless of
      cached membership or base revision.
- [ ] On reconnection, queued old-run operations fail without mutating history
      and the UI explains that the run was completed on another device.
- [ ] Completion and rejected-operation events reconcile without loops,
      duplicate runs, or a false synchronized state.
- [ ] Multi-client tests cover simultaneous completion, an offline shopper, and
      an account removed before its queue synchronizes.

## 25: Browse history and repeat recipes

**What to build:** Answer which recipes a list shopped for on a given day and
make those selections useful again without restoring an old checklist.

**Blocked by:** 23: Complete a shopping run atomically

**Status:** ready-for-agent

- [ ] Members can browse completed runs by list and locale-formatted completion
      date through stable pagination.
- [ ] A history detail shows the completing member, completion date, selected
      immutable recipe versions, and people counts—and no final checklist.
- [ ] Copy says the recipes were shopped for and never infers that they were
      cooked or that every item was purchased.
- [ ] A member can explicitly add a recent run's recipe versions and people
      counts to the current run through normal selection rules.
- [ ] Repeating a run generates a fresh checklist with default ordering and no
      old purchased, already-have, override, or pantry state.
- [ ] Integration and browser tests cover historical version resolution,
      authorization, date lookup, and repeat behavior.

## 26: Submit a URL for secure import

**What to build:** Accept a public recipe URL as durable remote work without
giving the importer access to private networks, credentials, or unbounded data.

**Blocked by:** 06: Edit complete structured recipes

**Status:** ready-for-agent

- [ ] A signed-in user can submit only an HTTP or HTTPS URL and see durable
      queued, processing, retrying, failed, or preview-ready status.
- [ ] Enqueueing uses an idempotency key and the job stores only necessary
      references and metadata, not cookies, secrets, or full recipe documents.
- [ ] Fetching validates DNS and resolved IPs before requests and after every
      redirect, blocking loopback, private, link-local, reserved, multicast, and
      cloud-metadata targets.
- [ ] Requests forward no user credentials and enforce redirect, byte, duration,
      and content-type limits without bypassing authentication, paywalls, or
      explicit technical blocks.
- [ ] Import submission and status reads are authorized and rate-limited, and a
      failed worker cannot impair saved recipes, discovery, or shopping.
- [ ] Security tests cover DNS rebinding, redirects to blocked targets, oversized
      responses, timeouts, unsupported content types, and retry exhaustion.

## 27: Review extracted recipe data

**What to build:** Convert fetched recipe facts into an editable, transparent
preview so the user—not the parser—decides what becomes a saved recipe.

**Blocked by:** 07: Parse and correct ingredient lines; 26: Submit a URL for
secure import

**Status:** ready-for-agent

- [ ] The base adapter extracts Schema.org `Recipe` data when present and maps
      title, yield, ingredients, instructions, metadata, and attribution into the
      structured editor.
- [ ] The preview lets the user correct title, typical yield, ingredient
      structure, ordered instructions, source facts, and attribution before save.
- [ ] Partial extraction preserves every safe useful field and opens a prefilled
      manual editor instead of discarding data.
- [ ] Hostile markup is sanitized and cannot execute or inject active content;
      unsupported editorial prose is not copied into the normalized record.
- [ ] The preview clearly states that saving an import will not add it to an
      active shopping run.
- [ ] Parser tests use synthetic or licensed HTML fixtures and cover incomplete,
      malformed, hostile, and missing-quantity recipes.

## 28: Save and deduplicate public imports

**What to build:** Save an approved preview as a provenance-rich public recipe
without silently creating duplicate catalog entries.

**Blocked by:** 08: Version recipes and control visibility; 27: Review extracted
recipe data

**Status:** ready-for-agent

- [ ] Saving records submitted and canonical URLs, source domain, source title
      and author when present, importer, timestamp, acquisition method, content
      fingerprint, version relationship, and known rights metadata.
- [ ] Canonical URL and fingerprint checks reuse or propose the existing public
      recipe instead of silently creating a duplicate.
- [ ] Materially different content may create a related immutable version, with
      the source and relationship visible before confirmation.
- [ ] A successful import becomes discoverable to other users and appears in
      the importer's library, but never changes an active run automatically.
- [ ] Concurrent or retried saves are idempotent and cannot create duplicate
      public identities or versions.
- [ ] Integration tests cover deduplication, version coexistence, public search,
      private boundaries, and complete provenance.

## 29: Add replaceable importer adapters

**What to build:** Support site-specific and generic extraction as isolated
adapters that operators can disable without harming Platter's core workflows.

**Blocked by:** 27: Review extracted recipe data; 28: Save and deduplicate public
imports

**Status:** ready-for-agent

- [ ] The adapter contract accepts bounded fetched content and returns either a
      normalized candidate, a partial candidate with warnings, or a typed failure.
- [ ] Selection tries Schema.org first, then an enabled supported site adapter,
      then generic extraction without weakening fetch security.
- [ ] Operators can disable a source adapter, and its failure or absence leaves
      manual recipes, saved recipes, discovery, and shopping available.
- [ ] Failed and historical jobs can be safely retried or reprocessed through
      the typed job registry without duplicate saves.
- [ ] A disappeared source leaves the normalized recipe and provenance intact
      and can be marked unavailable when detected.
- [ ] Adapter contract, fallback order, deployment behavior, and fixture rights
      are documented and tested.

## 30: Enforce imported-content rights and provenance

**What to build:** Make source and reuse facts visible throughout the public
recipe experience and prevent unlicensed media or prose from entering it.

**Blocked by:** 28: Save and deduplicate public imports

**Status:** ready-for-agent

- [ ] Every imported public recipe preserves and displays its source name and
      link in detail views and other contexts where full attribution is required.
- [ ] Ingredient facts, yield, time, and concise procedural steps are separated
      from substantial editorial prose, which is not copied.
- [ ] Each copied image has independent provenance and is stored or displayed
      only when the known license or permission permits; otherwise an allowed
      image, user image, or no image is used.
- [ ] Unknown rights are represented honestly and never inferred from the
      presence of Schema.org data or public accessibility.
- [ ] Bulk-ingested datasets require recorded compatible terms and attribution;
      noncommercial data cannot silently enter a potentially commercial catalog.
- [ ] Attribution and license fixtures verify visibility after normalization,
      discovery, versioning, and source unavailability.

## 31: Process public-content complaints

**What to build:** Give the public a clear removal-request path and give
administrators a privacy-restricted, auditable workflow for responding.

**Blocked by:** 28: Save and deduplicate public imports; 30: Enforce
imported-content rights and provenance

**Status:** ready-for-agent

- [ ] The public copyright and contact experience explains how to submit a
      removal request and how contact information will be handled.
- [ ] A rate-limited report can identify an affected recipe or source and create
      a complaint with type, status, timestamps, and minimum necessary contacts.
- [ ] Only administrators can view complaint contacts or transition a complaint
      through received, actioned, countered, restored, or closed states.
- [ ] Administrative access to private data is exceptional, authorized, and
      auditable; contacts stay out of general logs and public APIs.
- [ ] Hosted-policy copy distinguishes product functionality from legal advice
      and leaves jurisdiction-specific operator obligations configurable.
- [ ] Integration tests cover public submission, validation, rate limits,
      restricted fields, audit transitions, and unauthorized access.

## 32: Suppress recipes, sources, and domains

**What to build:** Let administrators remove disputed public content promptly
and stop automatic republication without breaking legitimate private history.

**Blocked by:** 29: Add replaceable importer adapters; 31: Process public-content
complaints

**Status:** ready-for-agent

- [ ] Administrators can find public content by recipe ID, URL, domain, importer,
      or content fingerprint.
- [ ] An administrator can suppress a recipe, source URL, or domain with a
      reason, actor, timestamp, and audit linkage.
- [ ] Suppression removes a recipe from public search and its public page while
      retaining the minimum private data needed for complaints and completed-run
      recipe references.
- [ ] New imports and reprocessing honor recipe, URL, fingerprint, source, and
      domain suppression before publication.
- [ ] Restoration is explicit and auditable; ordinary administrators do not gain
      shopping authority over a user's private list.
- [ ] Tests prove prompt public removal, republication prevention, historical
      resolution, domain suppression, and role enforcement.

## 33: Configure hosted public-catalog policy

**What to build:** Let a self-hoster understand and control optional public
catalog behavior, and keep hosted imports disabled until the operator publishes
the required policies and contacts.

**Blocked by:** 32: Suppress recipes, sources, and domains

**Status:** ready-for-agent

- [ ] Instance settings summarize email, analytics, public-catalog, importer,
      moderation, and source-adapter status without exposing secret values.
- [ ] An operator can disable public imports or specified adapters while manual
      recipes, existing saved recipes, and shopping continue to work.
- [ ] Hosted public imports cannot be enabled until terms, privacy policy,
      content-removal contact, and repeat-infringer handling are explicitly
      configured and published.
- [ ] Optional DMCA-agent and notice/counter-notice information can be configured
      for operators who choose that U.S. safe-harbor process.
- [ ] Optional integrations clearly disclose licensing, cost, and data-sharing
      implications and remain no-ops when unconfigured.
- [ ] Configuration validation and browser tests cover safe defaults, incomplete
      policy gating, and self-hosted operation without paid services.

## 34: Manage account data

**What to build:** Let a user manage their basic account information and obtain
a privacy-appropriate export of the data associated with them.

**Blocked by:** 01: Create and manage lists; 08: Version recipes and control
visibility; 09: Manage the personal recipe library

**Status:** ready-for-agent

- [ ] A signed-in user can view and update supported profile fields, including
      display name and locale, with server validation.
- [ ] Locale affects user-facing date and supported unit presentation without
      changing deterministic stored calculation values.
- [ ] A user can request and securely retrieve an export of their account,
      memberships, recipes, saved references, and other appropriate personal data.
- [ ] Exports exclude another member's private account data and restricted
      complaint contacts, and their creation and download are authorized.
- [ ] Account and export operations have clear progress, expiry, failure, and
      retry behavior with no sensitive data in analytics or logs.
- [ ] Integration tests cover ownership, export contents, locale, expiry, and
      attempts to retrieve another user's export.

## 35: Delete an account safely

**What to build:** Explain and enforce the exact effect of account deletion on
shared lists, private recipes, public imports, and immutable history.

**Blocked by:** 03: Manage list membership and ownership; 25: Browse history and
repeat recipes; 28: Save and deduplicate public imports; 34: Manage account data

**Status:** ready-for-agent

- [ ] Before confirmation, the user sees a concrete impact summary for owned
      lists, memberships, manually authored recipes, public imports, and history.
- [ ] A last owner must transfer ownership or explicitly delete each affected
      list before account deletion can proceed.
- [ ] Private content is deleted or anonymized according to documented policy,
      while immutable minimal snapshots keep legitimate completed-run references
      resolvable.
- [ ] Public imports and their provenance follow the stated public-content policy
      rather than disappearing or changing ownership silently.
- [ ] Authentication sessions, private caches, queued operations, and user-scoped
      offline storage are revoked or removed after successful deletion.
- [ ] The destructive operation is idempotent, auditable without retaining excess
      personal data, and covered across shared ownership and referenced recipes.

## 36: Instrument privacy-safe product analytics

**What to build:** Measure whether Platter's core workflow succeeds while
remaining optional and excluding the contents users entrust to the product.

**Blocked by:** 04: Notify users about membership changes; 09: Manage the
personal recipe library; 10: Browse public recipes; 22: Support offline shopping
and reconciliation; 25: Browse history and repeat recipes; 28: Save and
deduplicate public imports

**Status:** ready-for-agent

- [ ] Typed events cover list creation or joining, usable-recipe creation,
      selection and run completion, recipe count per run, review actions, merge
      corrections, import outcomes, synchronization reliability, collaboration,
      and history reuse.
- [ ] The primary repeated-completion signal can identify runs generated from
      two or more recipes without recording which recipes they were.
- [ ] Recipe content, ingredient text, grocery content, URLs, complaint contacts,
      and secrets are impossible or explicitly rejected event properties.
- [ ] Client and server adapters remain typed no-ops unless analytics is
      explicitly enabled with valid configuration.
- [ ] Core application behavior and builds are identical with the analytics
      provider absent or unavailable.
- [ ] Contract tests verify allowed event shapes, forbidden properties, disabled
      behavior, and representative funnel calculations.

## 37: Harden product security and abuse controls

**What to build:** Verify that every delivered product boundary resists
unauthorized access, abusive volume, malformed data, and unsafe content.

**Blocked by:** 04: Notify users about membership changes; 10: Browse public
recipes; 26: Submit a URL for secure import; 31: Process public-content
complaints; 35: Delete an account safely

**Status:** ready-for-agent

- [ ] List IDs, recipe IDs, run IDs, history IDs, import IDs, and complaint IDs
      are treated as untrusted and checked against least-privilege policy on every
      page, API, realtime, and worker-triggering operation.
- [ ] All writes and external reads use shared schemas, stable problem responses,
      opaque IDs and cursors, and never expose stack traces or database errors.
- [ ] Authentication, invitations, imports, public search, and public reports
      have tested rate limits with useful retry behavior.
- [ ] User-authored content is sanitized, imported active content is never
      rendered, and secrets or private contacts do not enter logs or analytics.
- [ ] Administrative access to private user content is exceptional, policy-bound,
      and auditable rather than implied by the administrator role.
- [ ] A security regression suite covers horizontal and vertical authorization,
      enumeration resistance, injection, unsafe return URLs, and sensitive-data
      disclosure.

## 38: Validate performance and reliability targets

**What to build:** Demonstrate that the core experience remains deterministic,
responsive, and available under realistic mobile and multi-user conditions.

**Blocked by:** 10: Browse public recipes; 14: Combine compatible grocery
contributions; 22: Support offline shopping and reconciliation; 24: Synchronize
run completion across devices; 29: Add replaceable importer adapters

**Status:** ready-for-agent

- [ ] Production-like tests measure public discovery and normal list loads
      returning useful content within two seconds at the 95th percentile under
      documented expected load.
- [ ] Multi-client tests measure connected shopping updates within two seconds
      at the 95th percentile and record synchronization failure rates.
- [ ] Grocery generation produces byte-equivalent domain results for equivalent
      inputs across retry, process, and ordering variations.
- [ ] Required indexes support public search, canonical URL deduplication, list
      membership, active-run lookup, and history by list and date.
- [ ] A failed importer, parser, normalization step, search extension, analytics
      provider, or worker does not make saved recipes or shopping unavailable.
- [ ] Cached shell interaction and optimistic checklist feedback are tested on a
      documented mid-range mobile profile, with budgets recorded for regressions.

## 39: Complete accessibility and responsive QA

**What to build:** Make every completed Platter workflow usable on small screens
and by keyboard and assistive-technology users, not merely free of automated
violations.

**Blocked by:** 11: View a public recipe; 20: Shop with the active checklist;
22: Support offline shopping and reconciliation; 25: Browse history and repeat
recipes; 31: Process public-content complaints; 35: Delete an account safely

**Status:** ready-for-agent

- [ ] Core flows work without horizontal scrolling at 320 CSS pixels and remain
      clear at supported desktop widths in light, dark, and System themes.
- [ ] Navigation, dialogs, recipe fields, lists, merge correction, reordering,
      theme controls, review, and shopping are fully keyboard operable with
      visible focus and correct focus restoration.
- [ ] Automated checks report no serious or critical issues, and documented
      keyboard and screen-reader reviews cover the shopping journey.
- [ ] Remote changes, optimistic state, offline queues, reconciliation, and
      completion are announced usefully without excessive live-region output.
- [ ] Status never depends on color alone, normal text and controls meet WCAG
      2.2 AA contrast, and motion respects reduced-motion preferences.
- [ ] Common shopping actions remain one tap, touch targets are at least 44 by
      44 pixels, and all reordering has a non-drag alternative.

## 40: Verify the complete recipe-to-shopping journey

**What to build:** Prove that the assembled application fulfills the PRD as one
coherent, self-hostable product and leave its operational documentation true.

**Blocked by:** 24: Synchronize run completion across devices; 25: Browse history
and repeat recipes; 28: Save and deduplicate public imports; 32: Suppress
recipes, sources, and domains; 35: Delete an account safely; 36: Instrument
privacy-safe product analytics; 37: Harden product security and abuse controls;
38: Validate performance and reliability targets; 39: Complete accessibility
and responsive QA

**Status:** ready-for-agent

- [ ] Browser tests demonstrate the full mobile and desktop journey: register,
      create independently shared lists, find/import/author recipes, select and
      scale multiple recipes, review at home, shop collaboratively offline and
      online, complete a run, and use minimal history.
- [ ] Multi-client acceptance tests cover same- and different-item edits,
      disconnect and reconnect, membership removal, and completion elsewhere.
- [ ] Every acceptance criterion in the PRD has a traceable automated test or a
      documented, repeatable manual verification with captured evidence.
- [ ] The application remains installable and the entire core workflow works
      with self-hosted MongoDB and no paid recipe, search, analytics, or other
      proprietary API.
- [ ] Data model, importer adapter contract, grocery calculations,
      synchronization protocol, privacy boundaries, indexes, migrations, and
      deployment assumptions are current and linked from contributor docs.
- [ ] Clean-clone setup and every documented non-watch command pass; CI includes
      format, lint, type checks, unit, integration, browser, accessibility,
      security, and production-build checks.
- [ ] The repository contains no secrets, private data, unlicensed images, or
      improperly redistributable recipe content, and all policy templates are
      clearly distinguished from operator-completed public policies.
