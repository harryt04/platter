# Offline performance budget

The browser performance check uses the repository's Chromium project with a
test-local mobile profile: a 390 × 844 CSS-pixel viewport, a 2× device scale
factor, and 4× CPU throttling. It runs against the production build started by
Playwright and uses a disconnected browser context for the offline portions. This is the
documented mid-range mobile proxy for regression checks; it is intentionally
repeatable rather than a claim about every device's hardware.

The `tests/e2e/offline-performance.spec.ts` check records these budgets:

- The cached `/offline` shell must show the authenticated user's saved-run
  content within 2,000 ms after a disconnected reload.
- An offline checklist action must show its optimistic undo control within
  500 ms of the user's tap.

The check is tagged `@performance` and requires the provisioned E2E account.
Run it with `npm run test:e2e -- tests/e2e/offline-performance.spec.ts --project=chromium`.
