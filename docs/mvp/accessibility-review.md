# Accessibility and responsive review

This review records the repeatable keyboard and screen-reader evidence for the
completed navigation, recipe, list, grocery-correction, review, and shopping
surfaces. The active shopping journey remains the deepest browser review because
it combines responsive layout, shared state, offline behavior, and live
announcements.

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

## Keyboard evidence matrix

The aggregate keyboard criterion is covered by the following focused checks:

| Surface | Evidence | Expected result |
| --- | --- | --- |
| Mobile navigation | `tests/e2e/shopping-accessibility.spec.ts` — `traps and restores focus in mobile navigation` | The menu exposes its expanded state, traps focus, closes with Escape or route selection, and restores focus to its trigger. |
| Confirmation dialogs | `tests/unit/alert-dialog.test.tsx` and the completion, manual-item, and merge-correction browser paths in `tests/e2e/routes.spec.ts` | Opening moves focus into the dialog, Tab and Shift+Tab remain contained, and dismissal returns focus to the invoking action. |
| Recipe fields and ordered editor controls | `tests/unit/draft-editor.test.tsx` and `tests/e2e/routes.spec.ts` — `keeps recipe editor ordering keyboard-operable` | Labeled fields and controls are reachable by keyboard; moving or removing an ingredient or instruction restores focus to the relevant remaining control. |
| List and review controls | `tests/unit/shopping-mode-navigation.test.tsx`, `tests/unit/manual-grocery-items.test.tsx`, and the manual grocery browser path in `tests/e2e/routes.spec.ts` | Review and shopping navigation, manual-item editing, amount editing, and destructive removal have labeled keyboard actions and confirmation. |
| Merge correction and reordering | `tests/unit/contribution-detail.test.tsx`, `tests/unit/grocery-item-order-controls.test.tsx`, `tests/unit/grocery-category-order-section.test.tsx`, and the split-correction browser path in `tests/e2e/routes.spec.ts` | Possible matches are expandable, split correction is confirmable, and item/category keyboard moves restore focus after refresh. |
| Theme controls | `tests/unit/radio-group.test.tsx` and `tests/e2e/shopping-accessibility.spec.ts` — `supports arrow-key theme selection` | System, Light, and Dark form one native radio group with visible focus and arrow-key selection. |
| Shopping checklist | `tests/e2e/shopping-accessibility.spec.ts` and `tests/e2e/routes.spec.ts` — `checks and unchecks a grocery item independently while shopping` | Purchased actions are keyboard-activatable, retain visible focus and semantic state, and remain touch-safe at 320px. |

The shared `:focus-visible` rule in `app/globals.css` supplies the visible
focus treatment for links, controls, and form fields. Run the unit/component
checks together with the tagged Chromium review to reproduce this matrix.
