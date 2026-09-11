# Platter Scaffolding Setup Instructions

**Status:** Foundation scaffold implemented; feature lanes remain deferred

**Foundation scope:** Repository tooling, shared platform seams, design tokens,
application shells, working email/password authentication, and route-complete
placeholders

**Product scope:** [Platter MVP PRD](prd.md)

This document defines the foundation that must land before feature work begins.
Complete it as one coordinated change. After the completion gate passes, agents
may implement the PRD in parallel using the ownership rules in
[Parallel feature handoff](#parallel-feature-handoff).

The repository now contains the initial implementation of this foundation:
root-level Next.js application files, executable package commands, environment
and Docker Compose templates, typed platform seams, shell/theme placeholders,
route groups, browser/test configuration, and public-repository policy files.
The final acceptance gate below still governs release of feature agents; in
particular, service-backed auth, realtime, worker, PWA, and browser checks must
be run in a clean environment with Node 24 and the documented local services.

## Read before changing the scaffold

- [Product requirements](prd.md) defines product behavior, permissions, data
  concepts, edge cases, and final acceptance criteria.
- [Design system](../DESIGN.md) defines the visual direction, exact colors,
  typography, spacing, shell, accessibility, and motion.
- [UI implementation guide](ui-implementation-guide.md) defines component and
  screen-state expectations.
- [Copy and content guidelines](copy-and-content-guidelines.md) defines product
  vocabulary and user-facing language.
- [Application intentions](application-intentions.md) records the original
  product context.
- `../scaffolding` is the local exemplar for repository conventions. Reuse the
  preferences named below, not its source files or stale dependency versions.

If a choice in this file conflicts with the PRD, the PRD wins. If visual or copy
work conflicts with the design or content guide, pause and update the relevant
source-of-truth document in the same change.

## Completion outcome

At the end of this setup:

- a clean clone installs and runs a Next.js web process, realtime process,
  import worker, MongoDB replica set, and local SMTP inbox;
- email/password authentication and password recovery work;
- public, authenticated, and administrative route boundaries are real;
- every required product screen has a responsive placeholder at its final URL;
- the Platter light and dark themes, fonts, shell, shared states, and PWA assets
  are implemented;
- offline, realtime, job, search, API, database, and analytics seams have typed
  contracts and smoke implementations;
- formatting, linting, type checking, tests, and all production builds run in
  continuous integration; and
- feature agents can work inside isolated feature directories without changing
  foundation-owned files.

This setup does not implement recipe parsing, recipe or list persistence,
ingredient normalization, grocery calculations, collaboration behavior,
moderation workflows, or shopping-run business rules. Synthetic fixtures may
demonstrate their intended shape but must not masquerade as working behavior.

## Locked decisions

| Area | Decision | Reason |
| --- | --- | --- |
| Repository | One npm package with root-level `app/` | Matches the exemplar and keeps local operation simple. |
| Runtime | Node 24, Next.js 16 App Router, matching React 19 | Preserves the planned stack while correcting version drift. |
| Styling | Tailwind CSS 4 and shadcn/ui `new-york` with Radix primitives | Uses the maintained shadcn baseline and the documented Platter design. |
| Rendering | React Server Components by default | Keeps client JavaScript limited to interactive or browser-only behavior. |
| Database | Native MongoDB driver against an explicit database name | Avoids an ORM and preserves the PRD's document-model flexibility. |
| Local services | Single-node MongoDB replica set and Mailpit in Docker Compose | Supports change streams, jobs, transactions where needed, and password-reset testing. |
| Authentication | Better Auth email/password now; Google later | Authentication and protected placeholders must be real; Google needs human-owned OAuth credentials. |
| Realtime | Separate Socket.IO process using the Mongo adapter/emitter | Meets the two-second collaboration target without Redis or a custom Next.js server. |
| Jobs | Separate Agenda worker using its Mongo backend | URL imports need durable retries without adding Redis. |
| Offline | Serwist for the service worker and Dexie for user-scoped local state | Separates shell caching from durable client data and pending operations. |
| Search | A provider interface with MongoDB `$text` as the base implementation | Core discovery works without a paid or additional search service. |
| Testing | Vitest, Testing Library, MSW, fast-check, Playwright, and axe | Covers pure logic, UI, integration, property invariants, browser flows, and accessibility. |
| Analytics | PostHog adapter disabled by default | Self-hosting and all core workflows remain functional without analytics. |

## Phase 0: Preserve the documentation baseline

1. Run `git status --short` and record the existing user-owned changes. The
   current worktree intentionally uses `docs/mvp/prd.md`; do not restore the
   deleted `docs/mvp/product-requirements-document.md`.
2. Keep every existing document. Generate the application in a temporary
   directory and copy in only the selected application and configuration files.
3. Fix references to the former PRD filename in `README.md` or other documents.
4. Treat `docs/`, `README.md`, and the current `AGENTS.md` as inputs, not
   create-next-app output targets.

**Complete when:** the intended documentation diff is preserved, every local
documentation link resolves, and no product/design document was replaced by a
generated file.

## Phase 1: Bootstrap an aligned Next.js application

Use a temporary directory because the repository is not empty. Use
`create-next-app@16` with npm, TypeScript, Tailwind, ESLint, App Router, no
`src/` directory, and the `@/*` alias. Disable React Compiler for the foundation.
Do not use an unbounded `@latest` command that could silently install Next.js 17.

Bring the generated package metadata, Next.js configuration, TypeScript
configuration, PostCSS configuration, ESLint flat configuration, and base app
files into this repository. Then:

1. Set the package name to `platter`, keep it private, declare Node `24.x`, and
   commit `package-lock.json`.
2. Keep TypeScript `strict: true` and `strictNullChecks: true`. Preserve the
   exemplar preference `noImplicitAny: false`, while requiring explicit types
   at public interfaces.
3. Configure Prettier with single quotes, no semicolons, trailing commas, and
   the Tailwind class-sorting plugin.
4. Use direct `eslint` scripts. Next.js 16 no longer supplies `next lint`.
5. Keep `@/*` mapped to the repository root and use kebab-case file names.
6. Initialize shadcn/ui with `new-york`, Radix primitives, React Server
   Components, CSS variables, Tailwind 4, and these aliases:
   `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, and `@/hooks`.
7. Add only the primitives needed by the shell and placeholders: alert-dialog,
   avatar, badge, button, card, checkbox, dialog, dropdown-menu, form, input,
   label, popover, radio-group, scroll-area, select, separator, sheet, sidebar,
   skeleton, sonner, tabs, textarea, and tooltip.

Use current compatible releases within the selected major versions and record
the exact resolution in the lockfile. Do not copy package versions from the
exemplar; it mixes Next.js 16 with React 18 and an older ESLint configuration.

### Dependency groups

Install these capabilities and keep packages in the appropriate runtime or
development dependency section:

- application: `next`, `react`, `react-dom`, `better-auth`,
  `@better-auth/mongo-adapter`, `mongodb`, `zod`, `next-themes`,
  `react-hook-form`, `@hookform/resolvers`, `lucide-react`, `decimal.js`,
  `dexie`, `dexie-react-hooks`, `nodemailer`, `posthog-js`, and `posthog-node`;
- realtime and jobs: `socket.io`, `socket.io-client`,
  `@socket.io/mongo-adapter`, `@socket.io/mongo-emitter`, `agenda`, and
  `@agendajs/mongo-backend`;
- PWA/build tooling: `@serwist/turbopack`, `serwist`, `esbuild`, `tsx`, `tsup`,
  and `concurrently`; and
- testing: `vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `jsdom`,
  Testing Library packages, `msw`, `fast-check`, `@playwright/test`, and
  `@axe-core/playwright`.

Remove packages generated or inherited but unused after configuration is
complete.

**Complete when:** `npm install`, a minimal development server, ESLint, and the
TypeScript compiler run with mutually compatible versions and no documentation
has been overwritten.

## Phase 2: Establish repository boundaries and commands

Create this structure. A directory may begin with a short README or a minimal
typed entrypoint when no implementation belongs there yet.

```text
app/
  (admin)/
  (app)/
  (auth)/
  (browse)/
  (legal)/
  api/auth/[...all]/
  api/v1/
  serwist/[path]/
components/
  patterns/
  shell/
  states/
  ui/
features/
hooks/
lib/
  analytics/
  auth/
  contracts/
  db/
  env/
  jobs/
  offline/
  realtime/
  search/
server/
  realtime/
  worker/
scripts/
  db/
  seed/
tests/
  e2e/
  fixtures/
  integration/
  unit/
public/icons/
```

The root package must expose these commands after setup:

| Command | Required behavior |
| --- | --- |
| `npm run dev` | Run web, realtime, and worker development processes concurrently. |
| `npm run dev:web` | Run only Next.js development mode. |
| `npm run services:up` | Start MongoDB replica set and Mailpit. |
| `npm run services:down` | Stop local services without deleting their volumes. |
| `npm run build` | Build Next.js and bundle both auxiliary processes. |
| `npm run start:web` | Start the production Next.js build. |
| `npm run start:realtime` | Start the bundled Socket.IO service. |
| `npm run start:worker` | Start the bundled Agenda worker. |
| `npm run format` | Write Prettier formatting. |
| `npm run prettify` | Alias `format` for compatibility with the exemplar. |
| `npm run format:check` | Check formatting without writing. |
| `npm run lint` | Run ESLint without writing. |
| `npm run typecheck` | Run `tsc --noEmit`. |
| `npm run test` | Run the non-watch unit/component suite once. |
| `npm run test:watch` | Run Vitest interactively. |
| `npm run test:integration` | Run integration tests against the test database. |
| `npm run test:e2e` | Run Playwright against a production build. |
| `npm run test:a11y` | Run the tagged Playwright/axe accessibility checks. |
| `npm run db:indexes` | Idempotently create or reconcile declared indexes. |
| `npm run db:migrate` | Apply pending document transformations with a ledger. |
| `npm run db:seed:test-user` | Idempotently create the ignored local AI test account. |
| `npm run check` | Run format check, lint, typecheck, tests, and build. |

Tests may add narrower internal scripts, but the commands above are the public
developer contract and must stay accurate in `README.md` and `AGENTS.md`.

**Complete when:** every command exists, help text or documentation explains its
prerequisites, and each non-watch command exits successfully in its intended
environment.

## Phase 3: Configure environment and local services

Create `.env.example` with names and safe local defaults where possible. Keep
`.env.local`, `.env.test.local`, and all real secrets ignored.

| Variable | Purpose | Requirement |
| --- | --- | --- |
| `APP_URL` | Canonical application URL | Required; local default `http://localhost:3000`. |
| `NODE_ENV` | Runtime environment | Supplied by the runtime. |
| `MONGODB_URI` | Mongo replica-set connection | Required; local URI targets the published Mongo port with a direct connection to the single-node `rs0` replica set. |
| `MONGODB_DATABASE` | Explicit database name | Required; local default `platter_development`. |
| `BETTER_AUTH_SECRET` | Better Auth encryption/signing secret | Required; example contains no value. |
| `BETTER_AUTH_URL` | Better Auth base URL | Required; same local origin as the web app. |
| `SMTP_ENABLED` | Password reset and invitation email delivery | Explicit opt-in; local Mailpit default is `true` in `.env.example`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | Password reset and invitation email delivery | Required when SMTP is enabled; local defaults target Mailpit. |
| `RECIPE_IMPORTS_ENABLED` | Allow new public recipe URL imports and source refreshes | Optional; `true` by default. Set to `false` to keep manual recipes, existing saved recipes, and shopping available while disabling public import work. |
| `RECIPE_IMPORT_DISABLED_ADAPTERS` | Comma-separated recipe import adapter IDs to disable | Optional; empty by default. Disabled adapters fail only their import job. |
| `PUBLIC_CATALOG_POLICIES_PUBLISHED` | Affirm that the hosted terms, privacy, removal-contact, and repeat-infringer policies are published | Defaults to `false`; production public imports remain disabled until this is `true` and all four policy fields below are configured. |
| `PUBLIC_CATALOG_TERMS_URL`, `PUBLIC_CATALOG_PRIVACY_URL` | Published hosted terms and privacy-policy URLs | Required for production public imports. |
| `PUBLIC_CATALOG_REMOVAL_CONTACT` | Public content-removal contact | Required for production public imports; do not use a private support credential. |
| `PUBLIC_CATALOG_REPEAT_INFRINGER_POLICY_URL` | Published repeat-infringer handling URL | Required for production public imports. |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` | Hosted SMTP settings | Optional locally. |
| `REALTIME_PORT` | Socket.IO service port | Local default `3001`. |
| `NEXT_PUBLIC_REALTIME_URL` | Browser-visible realtime origin | Local default `http://localhost:3001`. |
| `ALLOWED_ORIGINS` | Web/realtime origin allowlist | Required outside tests. |
| `POSTHOG_ENABLED` | Explicit analytics opt-in | Default `false`. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Optional PostHog settings | Required only when enabled. |
| `E2E_USER_NAME`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` | Local agent/browser account | Read from an ignored local `.env` or `.env.local`; fresh clones must populate these values locally. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Future Google sign-in | Documented and unset; no Google button until configured. |

Validate environment variables once in `lib/env`, with separate server-only and
browser-safe exports. A production configuration must fail early with a named
missing variable. Optional integrations must remain importable and become
no-ops when disabled.

Docker Compose must:

1. run MongoDB as a persistent single-node replica set named `rs0`;
2. initialize the replica set idempotently and wait for primary health;
3. run Mailpit with SMTP and browser inbox ports;
4. retain data across normal `services:down`; and
5. expose a separate test database without embedding production credentials.

The test-user seed reads credentials from the loaded local environment (normally
`.env` or `.env.local`), creates or updates only that local account, and never
prints the password. CI creates an ephemeral credential instead of relying on a
developer's file. Keep these values out of commits and other shared
documentation.

**Complete when:** a new contributor can copy `.env.example`, supply one local
auth secret, start services, initialize the database, seed a test user, and run
the application without an undocumented dependency.

## Phase 4: Build shared platform seams

### Database

- Provide one lazy Mongo client per process and an explicit database accessor.
- Keep collection names in feature-owned repository modules. Shared code owns
  only auth, job, migration, and realtime-adapter collections.
- Replace Gulp with TypeScript scripts that use `createIndexes` idempotently.
- Record document transformations in a migration collection with name,
  checksum, start/completion timestamps, and result.
- Never expose `ObjectId` across an API or client boundary.

### Authentication and authorization

- Configure Better Auth's Mongo adapter, email/password authentication, the
  Next.js route handler, server session helper, React client, and `nextCookies`
  last in the plugin list.
- Implement sign-up, sign-in, sign-out, forgot-password, and reset-password
  screens. Password-reset messages go through the SMTP adapter and revoke other
  sessions after a successful reset.
- Treat `proxy.ts` as an optimistic redirect only. `(app)` and `(admin)` layouts,
  API handlers, realtime handshakes, and worker-triggering operations perform
  authoritative server-side checks.
- Provide `requireSession`, `requireListRole`, and `requireAdmin` helpers. The
  list-role helper must resolve an active membership and allowed role before a
  protected list operation proceeds.
- Leave Google configuration as a documented extension point. The future human
  step is to create OAuth credentials and approved redirect URIs; the future
  implementation step is to register the provider and reveal its sign-in
  control only when both credentials validate.

### API contracts

- Product APIs live under `/api/v1`; Better Auth retains `/api/auth/[...all]`.
- Zod schemas validate input and output at trust boundaries.
- IDs are opaque strings, timestamps are UTC ISO-8601 strings, and calculated
  quantities are decimal strings. Use `decimal.js` inside calculation code.
- Errors use `application/problem+json` with `type`, `title`, `status`, `detail`,
  stable `code`, and optional field errors. Do not leak stack traces or Mongo
  errors.
- Cursor pagination uses opaque cursors and a stable sort. Do not expose Mongo
  cursor state.
- Route handlers remain thin: authenticate, parse, call a feature service, and
  translate the result. Services own authorization and business rules;
  repositories own database access.
- Use Server Actions only for connected-only UI. Any operation that must work
  offline uses the versioned HTTP mutation contract below.

Create shared branded types for `EntityId`, `IsoDateTime`, and `DecimalString`,
plus these minimum contracts:

```ts
interface MutationMetadata {
  operationId: string
  clientId: string
  baseRevision?: number
}

interface RealtimeEvent {
  type: string
  listId: string
  runId?: string
  revision: number
  operationId?: string
  occurredAt: string
}

interface QueuedOperation {
  operationId: string
  clientId: string
  listId: string
  runId: string
  kind: string
  payload: unknown
  baseRevision?: number
  createdAt: string
  attemptCount: number
  status: 'pending' | 'syncing' | 'failed' | 'synced'
}
```

Feature agents replace `string` event/operation discriminants and `unknown`
payloads with their feature-owned Zod discriminated unions. They extend the
contract without changing envelope fields.

### Realtime

- Run Socket.IO on its own HTTP server instead of replacing Next.js's server.
- Authenticate the handshake from the Better Auth session cookie and authorize
  every room join. Rooms are list-scoped; knowing a list ID grants nothing.
- Use `@socket.io/mongo-adapter` for multiple realtime instances and
  `@socket.io/mongo-emitter` so web and worker processes can publish after an
  accepted database change.
- Give the adapter event collection a TTL index.
- Events announce an authoritative revision and affected resource; clients use
  snapshot or delta APIs for recovery. Event delivery is not the durable source
  of truth.
- Provide `/health` and a smoke event. Real product event kinds belong to their
  feature agents.

### Background jobs

- Run Agenda in `server/worker` with the Mongo backend, graceful shutdown, job
  concurrency, retry/backoff, and structured logs.
- Define a typed job registry and a no-op/smoke job. Reserve import job names and
  payload schemas without implementing HTTP extraction.
- Job enqueueing must accept an idempotency key. Store only references and
  necessary metadata in job payloads, not full recipe documents or secrets.
- A failed worker cannot make saved recipes, discovery, or shopping unavailable.

### Search

- Define `SearchProvider.searchRecipes(query)` with text, structured filters,
  cursor, page size, and ranked result metadata.
- Implement a Mongo text-index provider over title, normalized ingredients,
  source, cuisine, tags, and dietary labels. Use explicit field weights and
  ordinary indexes for visibility and structured filters.
- Keep MongoDB Search or another service behind the same provider. Core tests
  exercise the base provider and require no paid service or `mongot` process.

### PWA and offline storage

- Configure `@serwist/turbopack`, `app/sw.ts`, the Serwist route handler,
  manifest metadata, offline fallback, generated icon assets, and production
  service-worker registration.
- Begin with conservative caching: versioned static assets, public shell assets,
  and `/offline`. Use network-first navigation. Never generically cache auth
  responses, private HTML, `/api/auth`, or `/api/v1` responses.
- Create a Dexie database factory scoped to the authenticated user. Define
  versioned tables for active-run snapshots and queued operations; product
  payloads must remain behind the typed mutation boundary.
- On sign-out, close and delete the prior user's private database and clear
  private caches before navigating to public content.
- Expose `offline`, `pending`, `syncing`, `synced`, and `failed` states. Never
  label a local operation synchronized until the server accepts it.

### Analytics

- Wrap client and server analytics behind a small adapter.
- Return a typed no-op implementation unless `POSTHOG_ENABLED=true` and the
  required settings exist.
- Centralize allowed event names and properties. Recipe content, ingredient
  text, grocery content, URLs, complaint contacts, and secrets are forbidden
  properties.

**Complete when:** every process has a health or smoke path, contracts compile,
disabled optional integrations are no-ops, and integration tests prove auth,
database, job, realtime, and private-cache boundaries.

## Phase 5: Implement the Platter visual foundation

Use the exact source colors from [the design system](../DESIGN.md). Map them to
Tailwind/shadcn semantic variables in both `:root` and `.dark`:

- background, foreground, card, card-foreground, popover,
  popover-foreground, border, input, ring;
- primary and primary-foreground from Cobalt;
- secondary and secondary-foreground from Marigold;
- muted and muted-foreground;
- accent and accent-foreground;
- success, warning, destructive, and their readable foregrounds; and
- sidebar, sidebar-foreground, sidebar-primary,
  sidebar-primary-foreground, sidebar-accent,
  sidebar-accent-foreground, sidebar-border, and sidebar-ring.

Use the documented hex values for source tokens. Supporting fills such as
muted backgrounds must use `color-mix()` from existing tokens rather than a new
one-off hex value. Preserve dark blue-charcoal surfaces and dark ink on
Marigold. Add explicit `control`, `button`, and `card` radius tokens so inputs
can use 4px, buttons 6-8px, and cards/dialogs 12px without abusing one global
radius.

Load `Instrument Sans`, `Fraunces`, and `DM Mono` through `next/font`. Map them
to UI/body, display, and data utilities. Enable tabular numerals for quantities.
Implement the type scale, 4px spacing basis, focus rings, 44 by 44px interactive
targets, reduced-motion behavior, and 150-250ms motion ranges from the design
system.

Use `next-themes` with storage key `platter-theme`, `defaultTheme="system"`, and
system support. Settings -> Appearance contains a labeled radio group for
System, Light, and Dark and shows the resolved theme for System. Theme selection
works immediately and is device-local during foundation work.

Create these shared components outside `components/ui`:

- `AppShell`, `AppSidebar`, `PublicHeader`, `AppHeader`, and active-list switcher
  placeholder;
- `PageHeader`, `PageSection`, and responsive content container;
- `PlaceholderPage`, `EmptyState`, `ErrorState`, and `LoadingSkeleton`;
- `OfflineBanner` and `SyncStatus`; and
- representative `RecipeCard`, `GroceryRow`, contribution-detail, and manual
  override shells with static props only.

The app shell uses the official shadcn `SidebarProvider`, `Sidebar`,
`SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`,
`SidebarFooter`, `SidebarRail`, `SidebarInset`, and `SidebarTrigger`
composition. Desktop collapses to icons. Mobile uses the supplied off-canvas
sheet. Header and footer remain sticky while only the content region scrolls.

Create a development-only `/dev/design-system` gallery covering tokens,
typography, all button/form states, focus, badges, banners, skeletons, grocery
rows, contribution detail, overrides, and both themes. Return `notFound()` for
this route in production.

Generate a temporary license-safe Platter monogram: Cobalt background, white
`P`, and sufficient safe area for a maskable icon. Supply SVG source, favicon,
Apple icon, and 192px and 512px PNG PWA assets. Mark it as replaceable branding.

**Complete when:** the gallery and application shell render correctly at 320px
and desktop widths, in light and dark themes, with visible focus, no
color-only state, no unintended horizontal scrolling, and automated AA contrast
checks for core token pairs.

## Phase 6: Create route-complete placeholders

Every placeholder uses final navigation, an `h1`, concise copy from the content
guide, the intended page hierarchy, and at most one obvious primary action. Use
small synthetic fixtures such as `Tacos`, `Curry`, `Family`, and `Personal`.
Do not include copied recipe directions, third-party imagery, or unlabeled
claims that a control already works.

### Route groups and access

- Root layout owns fonts, theme, PWA, analytics, global metadata, toast region,
  and connectivity state.
- `/` checks the session and redirects signed-in users to `/lists` and public
  visitors to `/discover`.
- `(browse)` uses a server layout that renders `AppShell` for a signed-in user
  and `PublicHeader` otherwise.
- `(app)` requires a validated session and renders `AppShell`.
- `(admin)` requires a validated session plus administrator role.
- `(auth)` redirects an already signed-in user to `/lists` where appropriate.
- `(legal)` stays public and uses the public shell.

### Public and browse routes

| URL | Placeholder purpose |
| --- | --- |
| `/discover` | Public discovery/search results, filter controls, loading skeleton, and empty state. |
| `/platter/[recipeId]` | Recipe title, yield, ingredients, directions, source, attribution, version, and image-license state. |
| `/sources` | Public source and attribution policy. |
| `/copyright` | Copyright/removal process overview. |
| `/copyright/report` | Removal-request form shell and privacy notice. |
| `/privacy` | Hosted-operator privacy-policy placeholder clearly marked for completion before launch. |
| `/terms` | Hosted-operator terms placeholder clearly marked for completion before launch. |
| `/offline` | Offline navigation fallback with useful recovery copy. |

### Authentication routes

| URL | Required foundation behavior |
| --- | --- |
| `/sign-in` | Working Better Auth email/password sign-in. |
| `/sign-up` | Working name, email, and password registration. |
| `/forgot-password` | Working request with non-enumerating confirmation. |
| `/reset-password` | Working token validation and password reset. |
| `/invitations/[token]` | Invitation summary and connected acceptance with invited-account and expiry checks. |

### Protected application routes

| URL | Placeholder purpose |
| --- | --- |
| `/my-recipes` | Personal library, search shell, and empty state. |
| `/platter/new` | Manual recipe-editor hierarchy and draft requirements. |
| `/platter/[recipeId]/edit` | Version-aware editor placeholder. |
| `/import` | URL entry, connectivity requirement, and editable-preview explanation. |
| `/lists` | Lists index, synthetic memberships, and create-list action. |
| `/lists/[listId]` | Recipe-selection/current-run summary. |
| `/lists/[listId]/members` | Members, roles, invitations, and owner-only actions. |
| `/lists/[listId]/review` | `Review at home`, `Already have`, calculated amount, override, and provenance shells. |
| `/lists/[listId]/shop` | Categorized checklist, purchased controls, contribution access, and sync status. |
| `/history` | Cross-list history entry point with list/date context. |
| `/lists/[listId]/history` | Minimal completed-run list. |
| `/lists/[listId]/history/[runId]` | Completion date and selected immutable recipe versions only. |
| `/settings` | Settings index. |
| `/settings/appearance` | Working System/Light/Dark selection. |
| `/settings/account` | Account details and future deletion-impact placeholder. |

### Administrative routes

| URL | Placeholder purpose |
| --- | --- |
| `/admin/public-recipes` | Find public content by ID, URL, domain, importer, or fingerprint. |
| `/admin/complaints` | Complaint queue and restricted contact-data warning. |
| `/admin/suppressions` | Audited recipe/source/domain suppression management. |
| `/settings/instance` | Self-hosting, public-catalog, email, analytics, and moderation settings summary. |

Add root and major-segment `loading.tsx`, `error.tsx`, and `not-found.tsx`
boundaries using the shared state components. Preserve the layout geometry in
loading states. Error recovery must name the failed area rather than display a
generic success/error toast.

**Complete when:** every URL has a route smoke test, public and protected access
matches the table, navigation reaches all non-detail entry points, and the
placeholder text follows the content guide.

## Phase 7: Testing, CI, and FOSS repository files

### Test configuration

- Configure Vitest projects for Node unit tests, jsdom component tests, and
  Mongo-backed integration tests. Keep pure calculation tests independent of
  Next.js and MongoDB.
- Use Testing Library queries by role and label. Use MSW at external HTTP
  boundaries; do not mock the code under test.
- Add fast-check as the property-test tool for later quantity, contribution,
  idempotency, and state-machine invariants.
- Configure Playwright for Chromium, Firefox, WebKit, a 320px mobile viewport,
  and a desktop viewport. Run against `next build` plus production processes,
  not development mode, for PWA/offline checks.
- Seed synthetic data and an ephemeral CI user. Make tests repeatable and safe
  to run concurrently by using isolated database names or run identifiers.

### Foundation test scenarios

1. Public visitors reach discovery, public recipe, and legal placeholders.
2. Anonymous access to protected pages redirects to sign-in with a safe return
   path; arbitrary external return URLs are rejected.
3. A user signs up, signs in, signs out, requests a reset, obtains the message
   from Mailpit in test setup, resets the password, and loses other sessions.
4. A normal user cannot open administrative routes.
5. The theme defaults to the system preference, persists a device override,
   clears it when System is selected, and avoids a hydration flash.
6. Every placeholder route renders at 320px without horizontal scrolling and
   has a single `h1`.
7. Keyboard users can open and close the sidebar, traverse navigation, use
   theme controls, and dismiss dialogs with restored focus.
8. Axe reports no serious or critical issues on shell, auth, discovery,
   review, shopping, and settings representatives.
9. The production PWA has a valid manifest and icons, installs a service worker,
   and renders `/offline` on an uncached navigation failure.
10. Auth and private API responses are absent from Cache Storage. Sign-out
    removes the prior user's Dexie database.
11. Two authenticated test clients authorized for one synthetic list receive a
    realtime smoke revision in under two seconds. A non-member room join fails.
12. The smoke job executes once, retries a forced transient failure, records
    terminal state, and allows graceful worker shutdown.
13. The Mongo search provider returns weighted synthetic results and respects
    visibility and structured filters.
14. The application imports and builds with PostHog and Google variables unset.

### Continuous integration

Create GitHub Actions workflows that install from the lockfile, cache npm and
Next.js build artifacts, start the Mongo replica set, create ephemeral secrets,
and run:

1. `npm run format:check`;
2. `npm run lint`;
3. `npm run typecheck`;
4. unit and integration tests with coverage;
5. `npm run build`; and
6. Playwright smoke/accessibility tests against the production build.

Upload Playwright traces, screenshots, and coverage only on failure or for a
short retention period. Add Dependabot for npm and GitHub Actions, CodeQL, and
secret scanning suitable for a public repository.

### Project documentation

Add or update:

- MIT `LICENSE`;
- `README.md` with exact clone-to-running setup and real commands;
- `AGENTS.md` with current paths, commands, ownership boundaries, and a pointer
  to this document for foundation/platform/placeholder changes;
- `.env.example` with no secrets;
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md`;
- issue templates and a pull-request template; and
- deployment notes for the three processes, same-origin reverse proxy,
  replica-set requirement, SMTP, optional analytics, and future Google OAuth.

**Complete when:** a clean-clone rehearsal and CI both pass using only committed
instructions, the repository is MIT licensed, and no secret, real recipe, or
unlicensed image is present.

## Parallel feature handoff

### Foundation checkpoint

Land and tag the completed scaffold before feature branches start. The
foundation integrator owns these high-contention files after that checkpoint:

- `package.json`, `package-lock.json`, root TypeScript/ESLint/Prettier/Next.js/
  Playwright/Vitest configuration, Docker Compose, and CI;
- `app/globals.css`, `components.json`, and `components/ui/`;
- shared shells, navigation configuration, manifest, service worker, and icons;
- common API, offline, realtime, auth, database, job, search, and analytics
  envelopes; and
- `README.md`, `AGENTS.md`, and cross-feature architecture documentation.

A feature agent that needs a new dependency, global token, shadcn primitive,
navigation entry, or shared-envelope change records the request for the
foundation integrator. It proceeds inside its feature boundary instead of
editing the shared file concurrently.

### Feature ownership

Each agent owns one `features/<slice>/` directory, its assigned page/API files,
feature-local schemas and repositories, and colocated tests. Avoid barrel files;
import from concrete modules. A feature PR must replace its placeholders,
preserve final URLs, and satisfy the relevant PRD, design, UI, and copy sections.

| Lane | Primary ownership | Can begin | Depends on |
| --- | --- | --- | --- |
| Accounts | Profile, account settings, deletion/export impact | After foundation | Working Better Auth and auth helpers |
| Lists | Lists, membership, roles, invitations | After foundation | Auth and API envelopes |
| Recipes | Manual recipes, versions, visibility, personal library | After foundation | Auth, Mongo repositories, decimal/ID conventions |
| Discovery | Public search, filters, ranking, pagination | After foundation | Search provider and recipe read contract |
| Imports/moderation | URL jobs, adapters, provenance, complaints, suppression | After foundation | Worker/job seam and recipe version contract |
| Grocery domain | Ingredient parsing, units, scaling, merging, contributions, overrides | After foundation | Decimal and shared ID conventions only |
| Shopping runs | Selection, review, checklist, completion, history | After list/recipe contracts stabilize | Lists, recipes, and grocery-domain contracts |
| Offline collaboration | Dexie payloads, idempotent mutations, reconciliation, realtime events | After mutation contracts stabilize | Shopping-run service contract and list authorization |
| Integration/quality | Cross-feature E2E, accessibility, performance, docs | Continuously after first feature merges | All affected lanes |

Lists, recipes, discovery UI, importer adapters, and grocery-domain logic can be
built in parallel once their minimal contracts are recorded. Shopping runs may
start against those contracts before implementations finish. Offline/realtime
behavior starts only after the mutation and revision contracts are fixed.

### Merge discipline

1. Rebase each lane on the tagged scaffold before implementation.
2. Keep each feature's public schema in its feature directory and test it at the
   boundary.
3. Merge foundational domain contracts before consumers; merge UI consumers
   afterward without relocating shared files.
4. Run `npm run check` and the lane's relevant Playwright scenarios before
   requesting integration.
5. Include screenshots for UI changes and note PRD or documentation changes.
6. Use synthetic or explicitly licensed fixtures and preserve source
   attribution in every public-recipe test shape.

## Final scaffold acceptance gate

Do not release feature agents until all boxes are true:

- [ ] Clean clone reaches a running application using the README only.
- [ ] Web, realtime, worker, MongoDB, and Mailpit report healthy.
- [ ] Email/password authentication and reset pass in a browser test.
- [ ] Public, protected, and administrator access boundaries pass.
- [ ] Every required placeholder URL exists and navigation is complete.
- [ ] Light, dark, and System themes use the documented Platter tokens.
- [ ] Mobile, keyboard, focus, contrast, and reduced-motion checks pass.
- [ ] PWA install, offline fallback, cache privacy, and sign-out cleanup pass.
- [ ] Realtime, worker, search, database index, and migration smoke tests pass.
- [ ] Analytics and Google OAuth can remain unconfigured.
- [ ] Format, lint, typecheck, unit, integration, E2E, and production builds pass.
- [ ] README, AGENTS, environment template, FOSS policy files, and CI are accurate.
- [ ] Foundation-owned files and parallel feature lanes are recorded for agents.

## Implementation references

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js testing](https://nextjs.org/docs/app/guides/testing)
- [Next.js offline support](https://nextjs.org/docs/app/guides/offline-support)
- [shadcn/ui with Next.js](https://ui.shadcn.com/docs/installation/next)
- [shadcn/ui Tailwind 4](https://ui.shadcn.com/docs/tailwind-v4)
- [shadcn/ui sidebar](https://ui.shadcn.com/docs/components/base/sidebar)
- [Better Auth MongoDB adapter](https://better-auth.com/docs/adapters/mongo)
- [Better Auth email/password](https://better-auth.com/docs/authentication/email-password)
- [Serwist Turbopack integration](https://serwist.pages.dev/docs/next/turbo)
- [Dexie documentation](https://dexie.org/docs)
- [Socket.IO with Next.js](https://socket.io/how-to/use-with-nextjs)
- [Socket.IO MongoDB adapter](https://github.com/socketio/socket.io-mongo-adapter)
- [MongoDB change streams](https://www.mongodb.com/docs/manual/changeStreams/)
- [MongoDB text search](https://www.mongodb.com/docs/manual/text-search/)
- [Agenda](https://github.com/agenda/agenda)

Consult these references during implementation, but preserve the product and
architecture decisions in this repository when upstream examples use different
names, colors, routes, or deployment assumptions.
