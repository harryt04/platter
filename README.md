# Platter

Platter is a mobile-first recipe-to-grocery app you can install on your device. It turns chosen recipes into one shared shopping list, shows where ingredients came from, supports recipe discovery and personal recipes, and works offline.

## Project status

The foundation scaffold, private recipe drafts with structured yield,
ingredients, ordered instructions, timing/classification metadata, household
notes, source attribution, and image provenance, plus list management,
owner-managed active members, owner-only invitation management, and recipient
invitation acceptance are in place. Recipe drafts also accept optional
informational nutrition values per person.
Product behavior such as recipe
parsing, ingredient normalization, grocery calculations, collaboration, and
moderation remains intentionally deferred to the feature lanes described in the
[scaffolding plan](docs/mvp/scaffolding-setup-instructions.md).

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
| `npm run test:integration` | Run integration tests; service-backed tests need Mongo. |
| `npm run test:e2e` / `test:a11y` | Run production Playwright or tagged accessibility tests. |
| `npm run db:indexes` / `db:migrate` | Reconcile indexes or apply the migration ledger. |
| `npm run check` | Format check, lint, typecheck, tests, and build. |
| `npm run ci` | Alias for the merge-ready local check. |

See [deployment notes](docs/mvp/deployment.md) for reverse proxy, MongoDB,
SMTP, analytics, and future Google OAuth guidance.
