# Repository content and policy hygiene

Platter keeps the repository safe to redistribute by checking tracked content
as part of `npm run check` and `npm run ci`. Run the focused check with
`npm run repository:check`.

The check verifies that:

- ignored `.env` files are not tracked, and tracked text does not contain common
  private-key, provider-token, or credential-assignment markers;
- raster assets are limited to the reviewed Platter branding inventory below;
- the hosted privacy and terms routes remain visibly marked as operator policy
  templates until the deployment owner completes them.

The check is intentionally a guardrail, not a substitute for reviewing a pull
request or rotating a credential that may have been exposed outside Git. CI
creates a fresh Better Auth secret at job start instead of storing one in the
workflow file. Local development and browser credentials belong in ignored
`.env` or `.env.local` files; `.env.example` contains names and safe blanks
only.

## Redistributable assets

These are project-owned Platter branding assets. They contain no recipe,
photographic, or third-party catalog content:

| Asset | Purpose |
| --- | --- |
| `app/apple-icon.png` | Apple touch icon |
| `public/icons/platter-192.png` | Installable PWA icon |
| `public/icons/platter-512.png` | Installable PWA icon |
| `public/icons/platter-maskable-512.png` | Maskable installable PWA icon |
| `app/icon.svg` and `public/icons/platter.svg` | Vector brand marks |

New raster or external media must include source, license or permission, and
attribution in the same change before it is added. Recipe-import tests use
synthetic inline content; the Mongo-backed import fixture records synthetic
attribution and CC BY 4.0 image-rights metadata without bundling external
recipe prose or image bytes. See [deployment notes](deployment.md#adapter-contract-fallback-order-and-fixtures).

## Operator policy templates

`/privacy` and `/terms` are deliberately incomplete foundation routes. Their
copy says that hosted operators must complete the policies before launch, so a
fresh deployment cannot mistake the repository template for an operator's
published legal policy. The copyright/removal route similarly describes
product behavior and directs operators to configure jurisdiction-specific
contacts and processes; it is not legal advice.
