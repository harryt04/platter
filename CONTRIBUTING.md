# Contributing to Platter

Read `AGENTS.md` and the [scaffolding plan](docs/mvp/scaffolding-setup-instructions.md)
before changing foundation files. Feature work belongs in one assigned
`features/<slice>/` directory and should preserve the final routes, typed API
envelopes, source attribution, responsive behavior, and accessibility rules.

Before opening a pull request, run `npm run check` and the relevant Playwright
scenarios. UI changes should include screenshots. Do not commit secrets,
private data, copied recipe content, or unlicensed imagery.
