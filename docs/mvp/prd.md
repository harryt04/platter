# Recipe-to-Grocery Application Product Requirements Document

**Status:** Draft 1  
**Date:** September 9, 2026  
**Product name:** Platter  
**License:** MIT  

## 1. Product summary

Platter is a mobile-first, installable web application that helps people discover or save recipes, select any number of recipes they intend to cook, and turn those recipes into one accurate grocery list.

Before leaving for the store, a user reviews the generated list against their refrigerator and pantry. They can mark an ingredient as already available or manually reduce the amount to buy without changing the source recipe. At the store, members of a shared list can split up and check off groceries together, with near-real-time updates when connected and reliable offline behavior when reception is poor.

The application is a recipe-to-grocery-list product. It is not a calendar-based meal planner, meal-prep scheduler, or pantry inventory system.

## 2. Problem

Planning several freshly cooked meals currently requires a person to:

1. Find recipes across unrelated websites or personal notes.
2. Manually combine their ingredients.
3. Resolve duplicate ingredients and incompatible measurements.
4. Check the combined list against food already at home.
5. Keep the list synchronized with another shopper in the store.
6. Remember later which recipes a previous shopping trip covered.

This work is repetitive and error-prone. Missed ingredients disrupt dinner; duplicate purchases create waste; and static lists make two-person shopping inefficient.

## 3. Product promise

> Select the recipes you want to cook and receive one trustworthy, shared grocery list with the correct combined amounts.

Recipe discovery, recipe storage, collaboration, and shopping history exist to support this promise.

## 4. Goals

- Make recipes discoverable from public recipe sources and other users' public imports.
- Support URL import and manual recipe entry.
- Scale recipe ingredients to the number of people who will eat the meal.
- Combine compatible ingredient requirements without losing their recipe provenance.
- Let users remove everything they already have before shopping, without maintaining pantry inventory.
- Support multiple independent lists per account, each shared with a different group.
- Keep a shared grocery checklist synchronized during multi-person shopping.
- Remain useful offline in stores with poor connectivity.
- Preserve a minimal record of which recipes were shopped for and when.
- Be straightforward to self-host and contribute to under the MIT license.

## 5. Non-goals

- Scheduling recipes on calendar days.
- Meal-prep or batch-cooking workflows.
- Leftover planning or tracking.
- Persistent refrigerator, freezer, or pantry inventory.
- Automatic ingredient consumption or spoilage tracking.
- Nutrition-based health advice.
- Restaurant procurement, supplier management, costing, approvals, or stock control.
- Delivery-service checkout or retailer integrations.
- Long-term preservation of completed ingredient checklists or purchase ledgers.
- Persisting a user's custom drag-and-drop grocery ordering between newly generated shopping runs.

The collaboration model may also be useful to chefs or small teams, but the product is designed for home cooks and informal groups.

## 6. Users and principal scenarios

### 6.1 Primary user

A home cook who prefers fresh meals, chooses several recipes before shopping, and wants to buy the right ingredients without creating leftovers.

### 6.2 Collaborating shopper

A partner, family member, roommate, or colleague who shares a list and may shop at the same time. Two shoppers should be able to start at opposite ends of a store and see one another's progress.

### 6.3 Recipe contributor

A signed-in user who manually creates a recipe or imports one from a public URL. Manually authored recipes are private by default. URL-imported recipes contribute a normalized entry to the public discovery catalog.

### 6.4 Self-hosting administrator

An individual or organization operating its own instance without depending on a paid recipe API for the core workflow.

## 7. Product terminology

- **Recipe:** A versioned set of ingredients, preparation instructions, yield, and metadata.
- **Typical yield:** The number of people a recipe normally feeds, entered when the recipe is created or imported.
- **List:** A persistent collaboration space, such as `Family`, `Restaurant A`, or `Personal`.
- **Shopping run:** The current set of recipe selections and its derived grocery checklist within a list.
- **Recipe selection:** A recipe version added to a shopping run with a desired number of people.
- **Calculated requirement:** The ingredient amount derived from selected recipes.
- **Shopping amount:** The amount the user currently intends to buy. It may differ from the calculated requirement after a manual adjustment.
- **Already have:** An all-or-nothing decision that no purchase is needed for that grocery item.
- **Purchased:** An item checked off during shopping.
- **Contribution:** The portion of a grocery item supplied by one recipe selection or a manual addition.

The UI may use the familiar word **cart** for a shopping run, but the data model must keep recipe selections, grocery requirements, and purchased status distinct.

## 8. End-to-end experience

1. A user signs in and opens or creates a list.
2. The user discovers a public recipe, imports a URL, opens a saved recipe, or creates one manually.
3. The user adds a recipe to the active shopping run and states how many people it should feed.
4. The application scales every ingredient relative to the recipe's typical yield.
5. The application combines compatible ingredients across all selected recipes.
6. The user opens the pre-store review and checks the refrigerator and pantry.
7. The user marks entire grocery items as already available or manually reduces shopping amounts.
8. At the store, all list members see the categorized checklist. Connected clients receive near-real-time updates; disconnected clients continue working and synchronize later.
9. A user completes the run. The application records the completion date and selected recipe versions with their serving counts.
10. The list receives a new empty active shopping run.

No calendar assignment is required at any point.

## 9. Functional requirements

### 9.1 Accounts and authentication

- Users must be able to create an account, sign in, sign out, and recover access.
- Sensitive pages and APIs must validate the server-side session.
- A user must be able to delete their account.
- Account deletion must explain the fate of shared lists, manually authored recipes, and public imports before confirmation.
- Account deletion removes private authored recipe documents and personal
  account artifacts. A recipe version referenced by an active or completed run
  is retained only as an anonymous unavailable identity snapshot so the pinned
  reference remains resolvable; unreferenced versions are deleted.
- Approved public imports remain in the public catalog after account deletion so
  their source and rights provenance remain truthful. Their catalog and
  immutable-version ownership is replaced with an anonymous system owner, and
  the deleted user’s import jobs and saved references are removed.
- Account deletion writes one retry-stable, metadata-only audit record with a
  pseudonymous account fingerprint and aggregate impact/cleanup counts. It
  never retains the deleted account's email, name, raw identifier, recipe
  content, grocery content, or password.
- Public recipe discovery may be browsed without authentication; saving, importing, editing, or using a list requires authentication.

### 9.2 Lists and sharing

- An account may belong to any number of lists.
- A user may create, name, rename, archive, leave, or delete a list when authorized.
- Every list has one active shopping run.
- Every list has at least one owner.
- Owners can invite and remove members, promote another owner, rename the list, archive it, and delete it.
- Editors can discover recipes, manage recipe selections, adjust the grocery checklist, and shop collaboratively.
- Ownership must be transferred before the last owner can leave.
- An invitation must be revocable and expire after a configurable period.
- Sharing is scoped to a list. Membership in `Family` does not grant access to `Restaurant A`.
- View-only membership and public shopping-list links are not required.

### 9.3 Recipe discovery

- Users must be able to search and browse public recipes by title, ingredient, source, cuisine, tag, and dietary label when those fields exist.
- Search results must show title, image when reuse is permitted, source, typical yield, and summary metadata.
- Search ranking should favor title matches, ingredient matches, completeness, and useful engagement signals without hiding source attribution.
- Users must be able to filter recipes and paginate or progressively load results.
- A recipe detail page must show its ingredients, directions, yield, source, attribution, and available license information.
- The core product must not require a paid third-party discovery service.
- Clearly licensed or public-domain sources may be ingested in bulk when their terms are satisfied.

### 9.4 URL import and public catalog behavior

- A signed-in user may paste a publicly accessible HTTP or HTTPS recipe URL.
- The importer should parse Schema.org `Recipe` data when present and fall back to supported site-specific or generic extraction.
- The import preview must let the user correct the title, typical yield, ingredient structure, instructions, and attribution before saving.
- A successful URL import stores a normalized recipe in the application's database and makes it discoverable to other users.
- Repeated imports of the same canonical URL should reuse or propose the existing public recipe rather than create silent duplicates.
- Materially different versions may coexist, but their source and version relationship must be visible.
- Imports must preserve the submitted URL, canonical URL when available, source domain, source title, source author when available, import timestamp, importer, and content fingerprint.
- Public accessibility is the product's operational threshold for recipe import. The product must still preserve attribution, provide source links, and support removal or suppression requests.
- Ingredient facts, yield, time, and concise procedural steps may be copied into the normalized public record.
- Publisher photographs, illustrations, and substantial editorial prose should be copied only when the applicable license or permission allows it. Otherwise, use an allowed image, a user-provided image, or no image.
- The application must not bypass authentication, paywalls, access controls, or explicit technical blocks.
- A failed or incomplete extraction must fall back to a prefilled manual editor rather than discard all parsed data.
- Importing a URL must never silently modify an active shopping run.

### 9.5 Manual recipe entry and editing

- A user may create a recipe with only a title and save it as a draft.
- A recipe must have a valid typical yield and at least one structured ingredient before it can be added to a shopping run.
- The editor must support:
  - title and description;
  - typical number of people fed;
  - ordered ingredient lines;
  - quantity, unit, ingredient name, preparation note, and optional flag;
  - ordered instructions;
  - prep, cooking, and total time;
  - cuisine, meal type, tags, and dietary labels;
  - household notes;
  - source and attribution;
  - an image with recorded provenance;
  - optional nutrition data.
- Manually authored recipes are private by default.
- Their creator may share them with selected lists or explicitly publish them to the public catalog.
- Editing a public recipe creates a version or personal variant; it must not silently rewrite the recipe used by other people.
- Active shopping runs remain pinned to the selected recipe version until the user explicitly refreshes them.

### 9.6 Personal recipe library

- A signed-in user can save a public recipe to their personal recipe library without adding it to a shopping run.
- The library includes recipes authored by the user, imported by the user, explicitly saved from discovery, or shared through one of their lists.
- Users can search their library by title, ingredient, source, and tag.
- Removing a saved public recipe from the library does not delete it from the public catalog or from another user's library.
- Deleting a privately authored recipe requires confirmation when a list or completed-run record still references it. Historical references must remain resolvable through an immutable minimal snapshot.
- Personal notes and personal variants are private unless explicitly shared or published.

### 9.7 Serving calculation

- Every usable recipe declares how many people it typically feeds.
- When adding it to a shopping run, the user enters a positive whole number of people.
- The scale factor is `desired people / typical people fed`.
- Ingredient requirements retain sufficient decimal precision for correct aggregation.
- The display may use friendly fractions, but stored calculations must not accumulate display-rounding errors.
- Countable ingredients must show the calculated requirement without silently changing the recipe. If purchasing requires whole units, the UI may separately suggest a rounded shopping amount.
- Changing the desired number of people recalculates every contribution from that recipe.
- A recipe may be added more than once only through an explicit duplicate action. Duplicate selections remain independently removable and scalable.

### 9.8 Grocery-list generation

- Grocery items are derived from all active recipe selections plus explicit manual grocery additions.
- Each item retains its contribution breakdown, for example `2 onions from tacos + 1 onion from curry + 1 manual`.
- Removing a recipe selection removes only that selection's contributions.
- Removing the last contribution removes the grocery item unless it has a manual addition or user override that must be preserved.
- The application should automatically merge only high-confidence ingredient matches.
- Compatible measurements should be converted to a common calculation unit before merging.
- Incompatible dimensions must remain separate; mass and volume must not be converted without ingredient-specific conversion data.
- Low-confidence matches should remain separate and may be presented as optional merge suggestions.
- A user can undo or split an incorrect merge.
- A user can manually add, edit, and remove grocery items without editing any recipe.
- Grocery items should expose their calculated requirement, shopping amount, source recipes, category, and state.

### 9.9 Manual shopping-amount adjustments

- A user may replace the generated shopping amount with a smaller or larger amount.
- The override changes only the grocery checklist, never the underlying recipes or their contribution calculations.
- The UI must retain and expose both the calculated requirement and overridden shopping amount.
- If a recipe or serving change alters the calculated requirement, the explicit override remains in place and the user is warned.
- The user can reset an override to the current calculated requirement with one action.
- Package-size suggestions, when available, must be presented as editable guidance rather than guaranteed facts.

### 9.10 Pre-store review

- The active shopping run has a clear `Review at home` mode.
- Each grocery item can be marked `Already have` with one action.
- `Already have` is all or nothing; no pantry quantity is stored.
- Users who possess only some of a requirement manually reduce the shopping amount.
- Marking an item `Already have` preserves its calculated requirement and provenance so the action can be undone.
- The application must not ask users to catalog their refrigerator or pantry.
- The review can be revisited after shopping begins.

### 9.11 Grocery categorization and ordering

- Every grocery item should have a category such as produce, meat and seafood, dairy and eggs, bakery, pantry, canned goods, frozen, beverages, baking, household, or other.
- The application supplies a default category order approximating adjacency in a typical grocery store.
- Items are initially grouped by category and sorted consistently within a category.
- A user may drag categories or items into a preferred order for the current shopping run.
- That custom ordering is shared with the list for the current run.
- Custom ordering is not carried into a newly generated run; every new run starts with the default sort strategy.
- Uncategorized or uncertain items appear in `Other` and can be recategorized.

### 9.12 Collaborative shopping

- All list members may open the active checklist on their own devices.
- Checking an item marks it purchased and identifies the acting member.
- Connected clients should reflect another member's check, uncheck, quantity edit, addition, or removal within two seconds under normal conditions.
- Clients must continue to show the list and accept checklist actions while offline.
- Offline operations must use unique operation identifiers and be safe to retry.
- On reconnection, queued operations synchronize without duplicating manual items or losing unrelated checks.
- For conflicting actions on the same field, the latest server-accepted operation wins. The UI must visibly reconcile to the authoritative state.
- Destructive structural changes, such as removing a selected recipe while another member is shopping, require confirmation and must identify their list-wide impact.
- Presence indicators are optional; accurate item state is required.

### 9.13 Shopping-run completion and history

- An owner or editor may complete the active shopping run.
- Completion requires confirmation and is visible promptly to all connected members.
- A completed run records only:
  - its list;
  - completion timestamp and local calendar date;
  - the member who completed it;
  - selected recipe identifiers and immutable version references;
  - desired people for each recipe selection.
- The history view answers: `Which recipes did we shop for on a given day?`
- The application does not infer whether a recipe was cooked.
- The application does not retain the final ingredient checklist, purchased status, already-have status, or pantry state as product history.
- Completing a run creates a new empty active run for that list.
- A recent completed run may be used to add its recipes to the current run again, but it is not restored as an ingredient checklist.

### 9.14 Notifications

- Users must receive in-product notification of list invitations and material membership changes.
- Email invitations are permitted when email delivery is configured.
- Shopping-item checks should not generate push or email notifications.
- Optional installable-PWA notifications must be opt-in and are not required for real-time checklist synchronization.

### 9.15 Public-content administration

- Administrators need tools to find a public recipe by ID, URL, domain, importer, or content fingerprint.
- Administrators can remove a recipe from public search, disable its public page, record a reason, and prevent automatic re-publication of the same source.
- A public copyright/contact page must explain how to submit a removal request.
- A hosted operator seeking U.S. DMCA safe-harbor protection should designate an agent, publish the required contact information, implement notice and counter-notice handling, and maintain a repeat-infringer policy.
- A takedown disables public access promptly while preserving the minimum private audit information needed to process the claim.
- Domain-level suppression must be available when a publisher requests that its recipes not be imported publicly.
- Self-hosters control their own public-catalog and moderation settings.

## 10. State model

### 10.1 Shopping run

`active` → `completed`

- A list has exactly one active run.
- Completion is atomic: the old run becomes immutable history and a new empty active run is created.
- An archived or deleted list cannot accept new shopping operations.

### 10.2 Grocery item

The following dimensions are stored independently:

- calculated requirement;
- optional shopping-amount override;
- `alreadyHave` state;
- `purchased` state;
- category and current-run sort position.

An item marked `Already have` is excluded from the buy view. It is not automatically marked purchased. Undoing `Already have` returns it to the buy view with its prior override intact.

### 10.3 Recipe

- `draft`: incomplete and not selectable.
- `usable`: structured enough to add to a run.
- `suppressed`: unavailable to public discovery because of moderation or source policy.
- Visibility is independent: `private`, `shared`, or `public`.

## 11. Data model

The implementation may refine document boundaries, but it must preserve these concepts.

### 11.1 User

- identity and authentication references;
- profile name and locale;
- account status and timestamps.

### 11.2 List

- name, owner IDs, status, and timestamps;
- active shopping-run ID;
- membership references with role and invitation state.

### 11.3 Recipe and recipe version

- stable recipe identity and immutable version identity;
- owner/creator and visibility;
- title, metadata, typical yield, ingredients, and instructions;
- optional nutrition values per person when known, presented as informational
  data rather than health guidance;
- source and attribution;
- acquisition method and public-content state;
- separate user-scoped saved-recipe references that do not modify the public
  recipe or add it to a shopping run;
- timestamps and version relationship.

Imported recipes should record:

- submitted and canonical URLs;
- source domain, title, and author;
- importer and import timestamp;
- acquisition method;
- source content fingerprint;
- rights or license metadata when known;
- separate provenance for each copied image;
- source availability and last-check timestamp;
- suppression or takedown status.

### 11.4 Ingredient line

- original display text;
- parsed quantity and unit;
- normalized ingredient identity when confidence is sufficient;
- preparation note and optionality;
- category;
- parser confidence and user corrections.

### 11.5 Shopping run

- list ID, state, and revision;
- recipe selections pinned to recipe versions;
- generated grocery items and contribution records;
- manual additions and amount overrides;
- current-run ordering;
- idempotent collaboration-operation metadata;
- completion metadata retained according to the minimal-history policy.

### 11.6 Public-content complaint

- affected recipe/source references;
- complaint type and status;
- received, actioned, countered, restored, or closed timestamps;
- minimum necessary contact and audit information with restricted access.

## 12. Permissions

| Capability | Public visitor | Signed-in non-member | List editor | List owner | Administrator |
| --- | --- | --- | --- | --- | --- |
| Browse public recipes | Yes | Yes | Yes | Yes | Yes |
| Import or author recipes | No | Yes | Yes | Yes | Yes |
| View a private list | No | No | Yes | Yes | As required for support policy |
| Change active shopping run | No | No | Yes | Yes | No by default |
| Invite or remove list members | No | No | No | Yes | No by default |
| Rename, archive, or delete list | No | No | No | Yes | No by default |
| Moderate public recipes | No | No | No | No | Yes |

Administrative access to private user content must be exceptional, authorized, and auditable.

## 13. User interface

### 13.1 Primary navigation

- Discover
- My recipes
- Lists
- Active list shortcut
- Shopping history
- Account/settings

### 13.2 Required screens

- Public discovery and search
- Recipe detail
- URL import preview
- Manual recipe editor
- Lists index
- List membership and invitation management
- Recipe-selection/cart view
- Pre-store review
- Shopping checklist
- Minimal completed-run history
- Account and self-hosting-relevant settings
- Public source attribution and copyright/removal pages
- Administrative public-content tools

### 13.3 Mobile-first requirements

- All core actions must work comfortably at a 320 CSS-pixel viewport.
- Shopping controls must be usable one-handed with large touch targets.
- Item text, amount, category, and checked state must remain readable in bright environments.
- The active shopping checklist must avoid horizontal scrolling.
- The current state must not depend on color alone.
- Drag-and-drop ordering must have keyboard and button-based alternatives.
- Common shopping actions should require at most one tap from the checklist.

### 13.4 Accessibility

- Meet WCAG 2.2 AA for supported flows.
- Use semantic form controls, headings, labels, and live-region announcements.
- Screen readers must announce remote checklist changes without overwhelming the user.
- Focus must be managed after dialogs, deletes, merges, and navigation.
- Motion must respect reduced-motion preferences.

## 14. Offline and PWA behavior

- The application must be installable as a progressive web application.
- The active list shell, most recent active-run data, and recipe-selection summary should be available offline after first load.
- Offline users may check or uncheck items, mark `Already have`, and adjust shopping amounts.
- Actions that require remote validation, such as accepting invitations or importing URLs, must explain that connectivity is required.
- Pending operations and synchronization failures must be visible without blocking shopping.
- The application must never claim that changes are synchronized while they remain local.
- Cache invalidation must prevent a user from seeing another account's private data after sign-out on a shared device.

## 15. Recipe parsing and ingredient normalization

- Preserve the original ingredient text even after parsing.
- Parsing must tolerate common fractions, Unicode fractions, ranges, missing quantities, package sizes, and preparation notes.
- Units must distinguish count, mass, volume, and unknown dimensions.
- Unit conversion must be locale-aware and deterministic.
- Canonical ingredient matching must support aliases while preserving meaningful distinctions such as `yellow onion` versus `red onion` when they affect shopping intent.
- The application must never merge ingredients solely because their strings are similar.
- User corrections should be stored on the recipe version and immediately reflected in derived lists after explicit confirmation.
- Parser failures must degrade to separate human-readable lines, not prevent list generation.

## 16. Security and privacy

- Apply least-privilege authorization to every list, recipe, and administrative operation.
- Treat list IDs and recipe IDs as untrusted; possession of an identifier does not grant access.
- Validate all writes on the server with shared schemas.
- Rate-limit authentication, invitations, imports, search abuse, and public-content reports.
- Sanitize user-authored rich text and never render imported active content.
- Do not forward user cookies or credentials to imported URLs.
- The URL importer must defend against server-side request forgery by allowing only HTTP/HTTPS, validating DNS and resolved IPs before requests and after redirects, and blocking loopback, private, link-local, reserved, multicast, and cloud-metadata addresses.
- Limit import redirects, response bytes, duration, and content types.
- Keep complaint contact information out of general application logs and public APIs.
- Provide account-data export and deletion behavior appropriate to the deployment's privacy policy.
- Secrets must be supplied through environment configuration and never committed.

## 17. Performance and reliability

- Cached application-shell interaction should feel immediate on a mid-range mobile device.
- Public discovery and normal list loads should return useful content within two seconds at the 95th percentile under expected load.
- A connected collaborator's shopping update should appear on another connected device within two seconds at the 95th percentile.
- Checklist actions must receive immediate optimistic feedback and safely reconcile with the server.
- Every mutable API operation used offline must be idempotent.
- Grocery generation must produce the same output for the same recipe versions, servings, manual additions, and overrides.
- A partial import, normalization failure, or unavailable discovery source must not make saved recipes or shopping lists unavailable.
- Database indexes must support public recipe search, canonical-URL deduplication, list membership, active-run lookup, and history-by-list/date.

## 18. Analytics and success measures

Analytics must be optional for self-hosters and avoid collecting recipe contents or grocery-list contents by default.

Measure:

- percentage of new users who create or join a list;
- percentage who add at least one usable recipe;
- percentage who generate and complete a shopping run;
- median recipes per completed run;
- frequency of `Already have` actions and manual amount adjustments;
- ingredient merge corrections and split actions;
- URL-import success, correction, and failure rates by parser type;
- synchronization latency and offline-operation failure rates;
- multi-member participation in the same shopping run;
- returning use of recipe/date history.

The primary product success signal is repeated completion of shopping runs generated from two or more recipes.

## 19. Technical direction and repository conventions

Use the conventions in `/Users/harry/Documents/git/scaffolding` unless a documented implementation constraint requires a deviation:

- Next.js 16 App Router and TypeScript
- React and React Server Components by default
- Mobile-first Tailwind CSS
- shadcn/ui and Radix primitives
- Better Auth with server-side session validation
- MongoDB using the native driver
- PostHog as optional analytics
- Strict null checking and schema validation
- Prettier formatting with single quotes and no semicolons
- Protected routes under an authenticated route group

The scaffold currently has no test runner and no PWA or real-time synchronization package. The implementation must deliberately choose and document:

- unit, integration, and browser-test tooling;
- manifest, service-worker, cache, and offline-storage strategy;
- real-time transport and deployment topology;
- a background-job approach for safe URL imports and reprocessing;
- public recipe search indexing appropriate to MongoDB or a replaceable search service.

Do not copy known scaffold inconsistencies into this application. In particular, align the Next.js, React, and ESLint versions; use environment-based MongoDB configuration and the correct application database name; make optional analytics genuinely optional; and create a new MIT license rather than copying the scaffold's GPL-3.0 license.

The product behavior in this PRD is authoritative; a transport or library may change without changing the promised behavior.

## 20. External content and open-source policy

- The project source is released under the MIT license.
- The application license does not override the license of recipe content, images, imported datasets, or third-party components.
- Every bundled or bulk-ingested dataset must have its license recorded and satisfied.
- Schema.org `Recipe` markup is an extraction format, not a content license.
- Open sources such as Wikibooks may be incorporated subject to their attribution and share-alike requirements.
- Noncommercial datasets must not be treated as compatible with a potentially commercial hosted service.
- Parser code licensing and parsed-content rights are separate concerns.
- Source attribution must remain visible after normalization and public discovery.
- A hosted deployment must publish terms, a privacy policy, a content-removal process, and repeat-infringer handling before enabling public user imports.
- Recipe-source integrations must use replaceable adapters so a source can be disabled without breaking manual recipes, saved recipes, or shopping lists.

Relevant references:

- [U.S. Copyright Office Circular 33: Works Not Protected by Copyright](https://www.copyright.gov/circs/circ33.pdf)
- [U.S. Copyright Office Section 512 resources](https://www.copyright.gov/512/)
- [Schema.org Recipe](https://schema.org/Recipe)
- [Wikibooks copyright and reuse terms](https://en.wikibooks.org/wiki/Wikibooks:Copyrights)

This section records product and operational requirements, not legal advice. Operators remain responsible for the laws and source terms applicable to their jurisdiction.

## 21. FOSS project requirements

- Publish the source under an MIT `LICENSE` file.
- Include setup instructions that take a new contributor from clone to a running local instance without undocumented services.
- Include a complete environment-variable template with safe local defaults where possible.
- Document the data model, URL-import adapter contract, grocery-calculation rules, synchronization protocol, and deployment assumptions.
- Include `CONTRIBUTING.md`, a code of conduct, a security-reporting policy, and issue and pull-request templates.
- Keep the core workflow usable with self-hosted MongoDB and without proprietary or paid APIs.
- Clearly label optional hosted integrations and their licensing, cost, and data-sharing implications.
- Use automated dependency updates and secret scanning.
- CI must run formatting, linting, type checking, automated tests, and a production build for every pull request.
- Database index creation and migrations or document transformations must be repeatable and documented.
- Sample and development data must use synthetic recipes or content whose license permits redistribution.

## 22. Verification strategy

- Unit tests must cover serving-scale arithmetic, fraction display, compatible-unit conversion, merge confidence, contribution removal, overrides, and grocery-item state transitions.
- Property-based or table-driven tests should cover calculation invariants, including that removing one recipe cannot change another recipe's contributions.
- Integration tests must cover list authorization, invitation expiry, public/private recipe visibility, import deduplication, run completion, and idempotent offline operations.
- Importer security tests must cover redirects, DNS rebinding defenses, blocked address ranges, oversized responses, timeouts, unsupported content types, and hostile markup.
- Browser tests must cover the complete recipe-to-shopping journey on mobile and desktop viewports.
- Multi-client tests must simulate two shoppers changing the same and different items, temporary disconnection, reconnection, and run completion on another device.
- Accessibility checks must combine automation with keyboard and screen-reader review of the shopping workflow.
- License and attribution fixtures must verify that required public-recipe provenance remains visible.
- Production-like performance tests must validate public search, grocery generation, and the two-second collaboration target.

## 23. Edge cases and expected behavior

- **Zero or invalid typical yield:** Recipe remains a draft and cannot be selected.
- **Missing ingredient quantity:** Preserve and display the ingredient, but do not fabricate an amount.
- **Optional ingredient:** Include it with an optional label; the user can exclude it.
- **Duplicate recipe selection:** Require an explicit confirmation or duplicate action.
- **Recipe removed after manual list edit:** Remove only its contribution and retain intentional manual additions or overrides.
- **Recipe updated after selection:** Keep the active run pinned until the user reviews and accepts the newer version.
- **Incompatible units:** Show separate lines instead of guessing a combined amount.
- **Uncertain ingredient identity:** Do not merge automatically.
- **All contributions marked already available:** Keep the recipe selection and show an empty buy view with an explanation.
- **Two people check the same item:** Treat repeated checks as idempotent.
- **Check and uncheck conflict:** Latest server-accepted operation wins and all clients reconcile visibly.
- **Run completed on another device:** Stop accepting writes to the old run, synchronize the completion, and open the new active run.
- **Member removed while offline:** Reject later unauthorized operations and explain why they were not synchronized.
- **Imported URL disappears:** Keep the normalized record and source provenance; mark the source unavailable when detected.
- **Import redirects to a blocked network target:** Abort safely and report a generic import failure.
- **Public recipe suppressed:** Remove it from public discovery while preserving references needed for completed-run history.
- **List owner deletes their account:** Require ownership transfer or explicit list deletion first.

## 24. Acceptance criteria

The product described by this PRD is functionally complete when all of the following are demonstrable:

1. A user can register, create three differently named lists, and share each with a different set of users without access leaking between lists.
2. A user can find a public recipe, import a public URL, and manually author a private recipe.
3. A URL import shows editable parsed data, preserves its source, prevents canonical-URL duplicates, and becomes publicly discoverable after saving.
4. A recipe entered as feeding four people can be added for two or six people, producing ingredient requirements scaled by `0.5` or `1.5` respectively.
5. Selecting multiple recipes combines high-confidence compatible ingredients and exposes the amount contributed by each recipe.
6. Removing one recipe removes only its ingredient contributions and leaves other recipes and manual additions intact.
7. A user can mark a grocery item `Already have` without creating pantry inventory.
8. A user can reduce two cartons to one on the shopping list while the recipe calculations remain unchanged and visible.
9. A later serving or recipe change preserves the manual override, warns the user, and offers a reset to the new calculated requirement.
10. A generated list uses the default store-category order and supports temporary accessible reordering that is not reused by the next run.
11. Two members can check different items on separate devices and see connected updates within the synchronization target.
12. A shopper can load the list, lose connectivity, continue checking items, reconnect, and synchronize without duplicate actions or lost unrelated changes.
13. Completing a run leaves only the completion date, selected immutable recipe versions, selected people counts, list, and completing member in product history.
14. The history view lets a user see which recipes were shopped for on Tuesday without claiming that they were cooked.
15. A newly created run contains no preserved drag ordering, already-have flags, purchased flags, or pantry quantities from the previous run.
16. Public-content administrators can suppress an imported recipe and prevent its immediate republication from the same source.
17. Core recipe entry, selection, review, and shopping work on an installation with no paid recipe API configured.
18. All core flows work as an installable PWA on supported mobile browsers and satisfy the stated accessibility requirements.

## 25. Product name

The application is named **Platter**. Before a public launch, confirm trademark, package-name, app-store, social-handle, and domain availability.

## 26. Settled product decisions

- The document describes the full product vision without delivery phases.
- Recipe selection is unconstrained by calendar dates.
- The application targets fresh cooking, not bulk meal prep or leftovers.
- Users may maintain multiple lists and share each independently.
- A list has one active shopping run and minimal completed-run history.
- Typical recipe yield is expressed as people fed; selections scale from that baseline.
- Pantry review is per run, all or nothing, and never becomes persistent inventory.
- Partial on-hand quantities are handled through a manual shopping-amount override.
- Grocery ordering starts from a default store-category strategy; manual ordering lasts only for the current run.
- Connected collaborators receive near-real-time updates and offline actions synchronize later.
- URL-imported recipes enter the public discovery catalog with source provenance and operational takedown controls.
- The application remains useful without a paid third-party recipe service.
