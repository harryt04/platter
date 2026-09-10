# Platter

Platter is a mobile-first recipe-to-grocery app you can install on your device. It turns chosen recipes into one shared shopping list, shows where ingredients came from, supports recipe discovery and personal recipes, and works offline.

## Project status

This repo is in the planning and design phase. It contains the product requirements and design rules; app code and working development commands have not been added yet.

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

When app code is added, include setup, development, testing, and contribution instructions with the working project files.
