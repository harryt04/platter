# Repository Guidelines

## Repository Structure

This repo currently holds product and design plans for Platter, a mobile-first recipe-to-grocery app. App code has not been added yet.

- `README.md` — project overview and documentation entry point.
- `docs/mvp/prd.md` — main product rules, data model, planned technology, and acceptance checks.
- `docs/mvp/scaffolding-setup-instructions.md` — foundation setup, platform contracts, placeholder routes, and parallel-agent ownership.
- `docs/DESIGN.md` — colors, type, layout, accessibility, screen sizes, and motion.
- `docs/mvp/ui-implementation-guide.md` — UI work steps and component patterns.
- `docs/mvp/copy-and-content-guidelines.md` — product words, labels, states, and trust copy.
- `docs/mvp/application-intentions.md` — original product intent and context.

Read the main doc for the area you change. For UI, visual, screen-size, accessibility, or user-facing text work, read `docs/DESIGN.md`; also read the UI and copy guides when they apply.
For repository scaffolding, shared platform contracts, placeholder routes, or feature-lane ownership, read `docs/mvp/scaffolding-setup-instructions.md`.

## Development and Verification

There is no app build, development server, package file, or test runner yet. Do not list commands such as `npm test` or `npm run build` as working until the app adds them. When code is added, list the real install, development, format, lint, type-check, test, and production-build commands here and in the README. CI should run formatting, linting, type checks, automated tests, and a production build for every pull request.

## Coding and Documentation Style

The planned stack is Next.js 16 App Router, TypeScript, React Server Components by default, Tailwind CSS, shadcn/ui, Better Auth, and the native MongoDB driver. Follow the PRD rules: strict null checking, Prettier with single quotes and no semicolons, settings in environment variables, and protected signed-in routes. Use sentence case in product copy and keep Platter terms consistent.

## Change and Documentation Hygiene

Treat the PRD and design docs as the rules for product behavior. If a code, product, or design change makes `AGENTS.md`, the README, or a linked doc wrong, update that doc in the same change. Use relative links and keep each rule in one place. Never commit secrets, private data, or recipe content without checking its license and crediting its source.

## Commits and Pull Requests

Git history currently contains only `init commit`, so there is no consistent message style yet. Use short, action-based commits (for example, `docs: clarify UI implementation guidance`). Pull requests should explain the change, link an issue or requirement when one exists, include screenshots for UI changes, list the checks you ran, and note any doc or product-rule changes.
