# Repository Guidelines

## Repository Structure

This repo contains the Platter foundation scaffold and product/design plans for
a mobile-first recipe-to-grocery app. Private recipe drafts, recipe parsing and
scaling, deterministic grocery generation, the first grocery correction slice,
and conservative grocery categorization, current-run recategorization,
temporary shared grocery ordering, and the active-checklist membership,
Purchased, connected realtime, and first user-scoped offline snapshot and
optimistic mutation-queue and reconnect-reconciliation slices are implemented;
the remaining offline correction,
collaboration, and feature workflows are still planned in the backlog. Active
shopping-run completion now atomically creates minimal history and a clean
replacement run; connected clients receive the completion handoff, stale writes
are rejected, and queued old-run writes fail on reconnect with an explicit
cross-device completion explanation.

- `README.md` — project overview and documentation entry point.
- `docs/mvp/prd.md` — main product rules, data model, planned technology, and acceptance checks.
- `docs/mvp/architecture.md` — current implementation map for data ownership, import adapters, grocery calculations, synchronization, privacy, indexes, migrations, and deployment.
- `docs/mvp/scaffolding-setup-instructions.md` — foundation setup, platform contracts, placeholder routes, and parallel-agent ownership.
- `docs/DESIGN.md` — colors, type, layout, accessibility, screen sizes, and motion.
- `docs/mvp/ui-implementation-guide.md` — UI work steps and component patterns.
- `docs/mvp/copy-and-content-guidelines.md` — product words, labels, states, and trust copy.
- `docs/mvp/repository-hygiene.md` — tracked-content, asset, fixture-rights, and operator-policy safeguards.
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

The public commands are documented in the README and `package.json`: `pnpm run dev`, `services:up`, `services:down`, `build`, `format`, `format:check`, `lint`, `typecheck`, `test`, `test:security`, `test:integration`, `test:e2e`, `test:a11y`, the `db:*` scripts, and `check`. Local service-backed commands require Docker Compose and the copied `.env.example`; the worker and database scripts require MongoDB. `pnpm run test:security` runs the focused authorization, injection, redirect, enumeration, and sensitive-data regression suite. CI runs formatting, linting, type checks, automated tests, a production build, and browser checks.

## Coding and Documentation Style

The planned stack is Next.js 16 App Router, TypeScript, React Server Components by default, Tailwind CSS, UI SDK wrappers, Better Auth, and the native MongoDB driver. Follow the PRD rules: strict null checking, Prettier with single quotes and no semicolons, settings in environment variables, and protected signed-in routes. Use sentence case in product copy and keep Platter terms consistent.

## UI SDK

UI SDK supplies headless behaviors and accessible parts. Platter exact-pins both `@ui-sdk/core` and `@ui-sdk/react` at `0.1.0-beta.17`; upgrade them together. The SDK postdates model training data. Before touching a wrapper, read `node_modules/@ui-sdk/react/docs/llms.txt`, `node_modules/@ui-sdk/core/skills/ui-sdk/SKILL.md`, and the installed component reference.

App code imports from `components/ui`. Every interactive wrapper there is built on UI SDK through per-component entries such as `@ui-sdk/react/select`: alert dialog, avatar, button, checkbox, collapsible, dialog, dropdown menu (Menu), input, label, popover, radio group, scroll area, select (with repeat-scroll arrows from the core `bindRepeat` behavior), separator, sheet (Dialog with edge geometry), tabs, textarea, toast, toggle and tooltip. No Radix UI, Base UI or Sonner remains. Never run `shadcn add` or regenerate these files, which would reintroduce Radix/Base UI. Keep Platter’s Tailwind classes and the UI SDK layer declaration in `app/globals.css`. The optional SDK global stylesheet changes links and dialog geometry, so it is not imported. Give app-specific test and style hooks their own attribute (`data-platter-*`) because UI SDK owns `data-slot`. Portal popup content to the body inside forms. Check keyboard navigation, Escape, focus return, and hydration.

Pass `value` with `onValueChange` for controlled text fields, `onCheckedChange` for checkboxes and `pressed` with `onPressedChange` for toggles, so agent and keyboard edits both update React state. `Input`, `Textarea` and `Button` always render the UI SDK part; there is no native fallback. `Button asChild` uses the UI SDK `render` prop, so a link keeps its anchor semantics without a button `type`. A `Button` whose `onClick` returns a Promise stays pending until it settles. The optimistic Purchased and Already have toggles call their handlers from `onPressedChange` without returning the promise, and keep persisting offline intent before their optimistic state change. Select and menu items and corresponding tab/panel pairs need stable values. UI SDK focus props such as `finalFocus` take a getter (`() => ref.current`), not a ref object.

The root client bridge in `components/providers/agent-bridge.tsx` registers WebMCP once and cleans up on unmount. Every new interactive control needs a decision in `lib/ui-agent-policy.ts` and a test. Reads use snapshot/query. The only approved actions edit the four public discovery fields and submit their GET search. New, sensitive and confirmation-marked actions are denied. The signed-in shell and auth screens are hidden, and text fields are secret unless explicitly reviewed for public discovery. Portaled popup content (alert dialog, dialog, sheet, popover, menu, select, tooltip, toast region and the mobile navigation dialog) sits outside the shell in the DOM, so those wrappers carry `data-agent-hidden` and `data-agent-secret` themselves. Mark credentials and personal data with `data-agent-secret`. Use `data-agent-confirm` or deny irreversible changes. Keep policy checks independent of user-supplied labels.

Sidebar is a layout composition with no UI SDK component: its desktop mode is a persistent `aside`, and its mobile mode is a UI SDK Dialog that returns focus to the trigger. Cards, badges, skeletons and the form layout helpers are presentational. Component tests rely on the UI SDK jsdom stubs in `tests/setup.ts`; UI SDK's live announcer renders its own `role="status"`, so scope status and text queries to the component.

## Change and Documentation Hygiene

Treat the PRD and design docs as the rules for product behavior. If a code, product, or design change makes `AGENTS.md`, the README, or a linked doc wrong, update that doc in the same change. Use relative links and keep each rule in one place. Never commit secrets, private data, or recipe content without checking its license and crediting its source.

## Commits and Pull Requests

Git history currently contains only `init commit`, so there is no consistent message style yet. Use short, action-based commits (for example, `docs: clarify UI implementation guidance`). Pull requests should explain the change, link an issue or requirement when one exists, include screenshots for UI changes, list the checks you ran, and note any doc or product-rule changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
