# Repository Guidelines

## Repository Structure

This repo contains the Platter foundation scaffold and product/design plans for
a mobile-first recipe-to-grocery app. Private recipe drafts, recipe parsing and
scaling, and the first deterministic grocery-generation layer are implemented;
grocery correction, collaboration, and the remaining feature workflows are
still planned in the backlog.

- `README.md` — project overview and documentation entry point.
- `docs/mvp/prd.md` — main product rules, data model, planned technology, and acceptance checks.
- `docs/mvp/scaffolding-setup-instructions.md` — foundation setup, platform contracts, placeholder routes, and parallel-agent ownership.
- `docs/DESIGN.md` — colors, type, layout, accessibility, screen sizes, and motion.
- `docs/mvp/ui-implementation-guide.md` — UI work steps and component patterns.
- `docs/mvp/copy-and-content-guidelines.md` — product words, labels, states, and trust copy.
- `docs/mvp/application-intentions.md` — original product intent and context.
- `components/` — shared shell, state, pattern, and shadcn-style UI components.
- `features/<slice>/` — reserved ownership boundary for post-foundation feature lanes.
- `lib/` — typed platform seams for auth, database, jobs, offline, realtime, search, and analytics.
- `server/` — separate realtime and Agenda worker processes.
- `tests/` — Vitest unit/component/integration tests and Playwright browser tests.

Read the main doc for the area you change. For UI, visual, screen-size, accessibility, or user-facing text work, read `docs/DESIGN.md`; also read the UI and copy guides when they apply.
For repository scaffolding, shared platform contracts, placeholder routes, or feature-lane ownership, read `docs/mvp/scaffolding-setup-instructions.md`.

For local authenticated browser work, the ignored `.env` file contains the
test account variables `E2E_USER_NAME`, `E2E_USER_EMAIL`, and
`E2E_USER_PASSWORD` when they have been provisioned. A fresh clone will not
have those secret values; populate them locally before seeding or exercising
authenticated flows, and never commit them.

## Development and Verification

The public commands are documented in the README and `package.json`: `npm run dev`, `services:up`, `services:down`, `build`, `format`, `format:check`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `test:a11y`, the `db:*` scripts, and `check`. Local service-backed commands require Docker Compose and the copied `.env.example`; the worker and database scripts require MongoDB. CI runs formatting, linting, type checks, automated tests, a production build, and browser checks.

## Coding and Documentation Style

The planned stack is Next.js 16 App Router, TypeScript, React Server Components by default, Tailwind CSS, shadcn/ui, Better Auth, and the native MongoDB driver. Follow the PRD rules: strict null checking, Prettier with single quotes and no semicolons, settings in environment variables, and protected signed-in routes. Use sentence case in product copy and keep Platter terms consistent.

## Change and Documentation Hygiene

Treat the PRD and design docs as the rules for product behavior. If a code, product, or design change makes `AGENTS.md`, the README, or a linked doc wrong, update that doc in the same change. Use relative links and keep each rule in one place. Never commit secrets, private data, or recipe content without checking its license and crediting its source.

## Commits and Pull Requests

Git history currently contains only `init commit`, so there is no consistent message style yet. Use short, action-based commits (for example, `docs: clarify UI implementation guidance`). Pull requests should explain the change, link an issue or requirement when one exists, include screenshots for UI changes, list the checks you ran, and note any doc or product-rule changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
