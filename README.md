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
shopping changes such as completion and amount resets.
The ingredient parser now recognizes common quantity forms, preserves source
text, records qualitative confidence and a stable normalized identity when the
parse is sufficient, resolves a bounded set of high-confidence ingredient
aliases without collapsing meaningful varieties, classifies units by dimension,
degrades incomplete lines to readable unknown ingredients without a fabricated
amount, and performs high-precision locale-aware mass and volume conversions
with round-trip test coverage; grocery calculations, collaboration, and
moderation remain intentionally deferred to the feature lanes described in the
[scaffolding plan](docs/mvp/scaffolding-setup-instructions.md).
Public recipe reads also have a shared visibility guard: imported content must
be approved after review, usable, and explicitly public before it can render.
Recipes now have stable identities and incrementing immutable version IDs;
editing or deleting a recipe snapshots the prior version for future run and
history references. Authored usable recipes remain private until the owner
explicitly shares them with selected active lists or publishes them to the
public catalog; list-scoped access is checked against current membership.
Editing a published recipe creates a private personal variant with lineage to
the published version, leaving the public source unchanged.
Mongo-backed public discovery now applies the same usable, explicit-public, and
approved-import guard as public recipe reads; private searches require an
owner-scoped query. Public discovery now has a real anonymous and signed-in
search page and API backed by Mongo text search across recipe titles,
ingredients, source metadata, cuisines, tags, and dietary labels.
Shopping-run recipe references can resolve immutable historical snapshots by
version identity, preserving selection order and duplicates without falling
back to a later mutable recipe version.
Mongo-backed integration coverage now verifies private, list-shared, and public
visibility boundaries alongside historical version resolution.

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

The web app runs on `http://localhost:3000`, Socket.IO on port `3001`, and the
Mailpit inbox on `http://localhost:8025`. `npm run services:down` stops services
without removing the Mongo volume. Password reset mail is delivered to
Mailpit locally.

Set `SMTP_ENABLED=true` to deliver password-reset and invitation emails through
the configured SMTP server; the example configuration targets local Mailpit.

For the ignored local browser account, create `.env.test.local` with
`E2E_USER_NAME`, `E2E_USER_EMAIL`, and `E2E_USER_PASSWORD`, then run
`npm run db:seed:test-user`. The seed never prints the password.

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
