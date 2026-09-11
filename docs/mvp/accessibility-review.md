# Shopping accessibility review

This review covers the active shopping journey at the narrow mobile breakpoint
and at a desktop width. It is intentionally focused on the controls and
announcements a screen-reader user needs while moving through a store.

## Repeatable checks

Run the focused Chromium review with the authenticated test account:

```sh
CI=1 PORT=3100 APP_URL=http://localhost:3100 \
  BETTER_AUTH_URL=http://localhost:3100 \
  ALLOWED_ORIGINS=http://localhost:3100 \
  npm run test:e2e -- tests/e2e/shopping-accessibility.spec.ts --project=chromium
```

Use a free port for `PORT` when another local application owns port 3000; the
three URL settings must continue to point at the same origin for authentication
to accept the browser session.

The tagged shopping checks verify that:

- the shopping-mode navigation has an accessible name and exposes its review
  and shopping links;
- category groups are named lists and grocery rows expose list-item semantics;
- Purchased is an independently labelled toggle with an accurate
  `aria-pressed` state before and after the action;
- the action result is delivered through a polite status announcement;
- live-update, offline, synchronization, and completion messages use status or
  alert semantics without relying on color;
- keyboard activation works at 320px, focus remains visible, and the primary
  controls retain 44px targets; and
- axe reports no serious or critical violations in each supported theme.

The review also exercises System, Light, and Dark themes with reduced motion,
then repeats the no-horizontal-scroll check at desktop width. This is a
repeatable semantic review of the screen-reader surface; operators should pair
it with their preferred assistive technology during release QA.
