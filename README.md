# Platter

[![CI](https://github.com/harryt04/platter/actions/workflows/ci.yml/badge.svg)](https://github.com/harryt04/platter/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Recipe-to-grocery planning for people who cook at home.

[Try the beta](https://beta.platter.harryt.dev) · [Visit the project site](https://platter.harryt.dev) · [Contribute](CONTRIBUTING.md)

Platter helps you choose the recipes you want to cook, turn them into one
accurate grocery list, and shop with other people. It is a mobile-first,
installable web app that is designed to remain useful when a grocery store has
poor connectivity.

## Why Platter

Planning several meals usually means collecting recipes from different places,
combining their ingredients by hand, checking what is already at home, and
keeping another shopper up to date. Platter brings those steps into one
workflow:

1. Find, import, or create recipes.
2. Choose recipes and the number of people each should feed.
3. Review one generated list with ingredient calculations and recipe sources.
4. Mark items you already have or adjust what you intend to buy.
5. Shop together with a shared checklist, including when temporarily offline.

The goal is a grocery list you can trust without turning Platter into a pantry
inventory system or a meal calendar.

## Who it is for

- Home cooks who plan several fresh meals before going shopping.
- Partners, families, roommates, and other groups who share shopping work.
- Contributors who want an open recipe-to-shopping project to improve.
- Self-hosters who want the core workflow without a paid recipe API.

## What it does

- Discovers public recipes and preserves source attribution.
- Imports recipes from public URLs through a reviewable, replaceable adapter pipeline.
- Stores private recipes and personal recipe-library saves.
- Scales ingredient quantities to a chosen number of people.
- Combines compatible grocery contributions while showing where each amount came from.
- Keeps `Already have` separate from `Purchased`.
- Supports manual grocery items, amount adjustments, categories, and temporary ordering.
- Supports shared shopping with realtime updates and honest offline reconciliation.
- Keeps minimal shopping history without pretending that a recipe was cooked or every item was purchased.

## What it is not

Platter is not a calendar-based meal planner, meal-prep scheduler, persistent
pantry inventory, food-delivery service, or retailer checkout integration.

## Project status

Platter is in **early development** and is available as a beta. The core
recipe-to-shopping workflow is implemented, but the product is still receiving
new features, usability improvements, and operational hardening. Expect rough
edges and breaking changes, and treat self-hosted deployments as
pre-production software.

## Try the beta

Use the hosted beta at [beta.platter.harryt.dev](https://beta.platter.harryt.dev).
The [project site](https://platter.harryt.dev) contains the public project
information and links to the source repository.

## Local setup

### Requirements

- Node.js 24.x
- npm
- Docker Compose

### Run Platter locally

```sh
git clone https://github.com/harryt04/platter.git
cd platter
cp .env.example .env.local
```

Open `.env.local` and set `BETTER_AUTH_SECRET` to a random value of at least 16
characters. A local secret can be generated with:

```sh
openssl rand -hex 32
```

Then install dependencies, start the local services, initialize MongoDB, and
start the application:

```sh
npm install
npm run services:up
npm run db:indexes
npm run db:migrate
npm run dev
```

The local services are available at:

| Service | URL |
| --- | --- |
| Web app | <http://localhost:3000> |
| Realtime service | <http://localhost:3001> |
| Mailpit inbox | <http://localhost:8025> |

`npm run dev` starts the web app, realtime service, and import worker. Run
`npm run services:down` when you want to stop MongoDB and Mailpit. Normal
shutdown preserves the MongoDB volume.

### Optional browser test account

Authenticated browser tests require an ignored local account. Set
`E2E_USER_NAME`, `E2E_USER_EMAIL`, and `E2E_USER_PASSWORD` in `.env` or
`.env.local`, then run:

```sh
npm run db:seed:test-user
```

Never commit those values. A fresh clone does not contain them.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the web app, realtime service, and import worker. |
| `npm run build` | Build the web app and auxiliary processes. |
| `npm run format` | Format the repository. |
| `npm run format:check` | Check formatting without changing files. |
| `npm run repository:check` | Check tracked content for credential and asset-policy violations. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run the TypeScript compiler without emitting files. |
| `npm run test` | Run unit and component tests. |
| `npm run test:security` | Run focused security regression tests. |
| `npm run test:integration` | Run MongoDB-backed integration tests. |
| `npm run test:e2e` | Run the Chromium browser suite. |
| `npm run test:a11y` | Run tagged Chromium accessibility checks. |
| `npm run check` | Run formatting, repository, lint, type, test, and build checks. |
| `npm run ci` | Run the full local CI-style verification suite. |

Service-backed tests require the local MongoDB setup. Use a separate test
database for integration tests rather than the development database. See the
[deployment notes](docs/mvp/deployment.md) for the full environment and service
configuration.

## Self-hosting

Platter's core workflows are designed to run with self-hosted MongoDB and no
paid or proprietary recipe or search service. A deployment consists of a
Next.js web process, a Socket.IO realtime process, an Agenda import worker, and
a MongoDB replica set. SMTP and privacy-safe analytics are optional.

Read the [deployment notes](docs/mvp/deployment.md) before deploying. In
particular:

- MongoDB must run as a replica set, including for a single-node deployment.
- Hosted public recipe imports remain disabled until the deployment publishes
  its required terms, privacy, removal-contact, and repeat-infringer policies.
- The `/privacy` and `/terms` pages in this repository are operator templates,
  not ready-to-publish legal policies.
- Optional integrations must be configured explicitly and do not make manual
  recipes or shopping unavailable when disabled.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md) for
the pull request workflow and checks. UI changes should include screenshots,
tests should use synthetic or appropriately licensed fixtures, and changes
must not include secrets, private data, copied recipe content, or unlicensed
imagery.

The project maintains product and technical source documents separately from
this overview:

- [Product requirements](docs/mvp/prd.md): product behavior, terminology, permissions, and boundaries.
- [Architecture reference](docs/mvp/architecture.md): data ownership, imports, grocery calculations, synchronization, privacy, and migrations.
- [Design system](docs/DESIGN.md): visual language, responsive behavior, accessibility, and motion.
- [UI implementation guide](docs/mvp/ui-implementation-guide.md): component and screen-state guidance.
- [Copy and content guidelines](docs/mvp/copy-and-content-guidelines.md): product vocabulary and user-facing copy.
- [Repository hygiene](docs/mvp/repository-hygiene.md): content rights, assets, fixtures, and policy safeguards.

## Security and conduct

Please report vulnerabilities privately as described in
[SECURITY.md](SECURITY.md), not in public issues. Contributors are expected to
follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## License and content rights

The Platter source code is available under the [MIT license](LICENSE).

The MIT license does not grant rights to recipe content, images, imported
datasets, or other third-party material. Contributions must preserve source
attribution and verify the applicable license or permission for external
content.
