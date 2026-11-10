# Platter Design System

## Product context

- **What this is:** A mobile-first recipe-to-grocery-list application. It turns selected recipes into one trustworthy, shared shopping run while preserving ingredient provenance and offline usefulness.
- **Who it is for:** Home cooks and informal groups who plan a week of fresh meals and shop together.
- **Project type:** Installable Next.js web application, built with Tailwind CSS and shadcn/ui.

## Brand premise

**Cooking begins before the stove.** Platter makes the interval between recipe inspiration and the store feel considered, coordinated, and complete.

The product is a competent kitchen partner: warm enough to belong around food, precise enough to be trusted with calculations. It is not a generic recipe blog, a busy meal-planning dashboard, or a playful grocery-game interface.

### Visual direction

- **Name:** Prepared utility
- **Mood:** Clear, calm, capable, and lightly editorial.
- **Decoration:** Minimal. Content hierarchy, useful provenance, and deliberate color do the expressive work.
- **Layout:** Grid-disciplined application shell with editorial type reserved for recipe and moment-of-commitment content.
- **Signature:** Recipe contributions are visible, readable facts—not hidden implementation detail.

## Foundations

### Typography

Load these fonts through `next/font` where the app is built.

| Role | Family | Use |
| --- | --- | --- |
| Display | `Fraunces` | Recipe titles, a page-level moment such as “Review at home,” empty-state headlines. Never navigation or dense controls. |
| UI and body | `Instrument Sans` | Default application typeface; all navigation, forms, buttons, body copy, and instructions. |
| Data | `DM Mono` | Quantities, units, source/provenance, compact metadata, and small overlines. Use tabular numerals. |

Use `Instrument Sans` for all text by default. A serif heading is a deliberate content cue, not a decoration to repeat on every card.

| Token | Size / line height | Typical use |
| --- | --- | --- |
| `text-xs` | 12 / 16 | metadata, helper text |
| `text-sm` | 14 / 20 | controls, nav, dense list details |
| `text-base` | 16 / 24 | body and primary list labels |
| `text-lg` | 18 / 26 | section headings |
| `text-xl` | 20 / 28 | page title in utility views |
| `display-sm` | 30 / 34 | recipe or committed-state title |
| `display-lg` | 48 / 48 | sparse onboarding/marketing only |

### Color

The primary signal is **Cobalt** and the contrasting secondary signal is **Marigold**. They are separated by hue and luminance; never make color the only carrier of meaning.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Primary | `#0057D9` | `#60A5FA` | primary action, active navigation, links, focus ring |
| Primary foreground | `#FFFFFF` | `#0B1220` | text on primary fills |
| Secondary | `#F6A700` | `#F6A700` | rare attention/momentum signal, secondary action, small visual anchor |
| Secondary foreground | `#1E293B` | `#1E293B` | text on marigold; never use white text |
| Background | `#F7F7F5` | `#11161D` | app canvas |
| Surface | `#FFFFFF` | `#1C222C` | cards, main content, raised surfaces |
| Sidebar | `#FBFBFC` | `#151A22` | quiet navigation surface |
| Sidebar active | `#E8F0FF` | `#173B78` | selected menu item |
| Foreground | `#20232A` | `#EDF2FA` | primary text |
| Muted | `#606B7A` | `#A6B1C0` | secondary text |
| Border | `#DFE1E6` | `#303845` | structural separation |
| Success | `#19754B` | `#4EBD7A` | confirmed/successful state |
| Warning | `#925700` | `#FFCF63` | caution requiring attention |
| Destructive | `#BA2E3A` | `#FF8590` | irreversible or failed action |

Use semantic state tokens for success, warning, and destructive states. `Already have` and `Purchased` must each use a visible control state plus a text label; their meaning must survive grayscale, high contrast, and color-vision differences.

Use `text-warning` on tinted warning surfaces such as `bg-warning/10` or
`bg-warning/15`. Reserve `text-warning-foreground` for solid `bg-warning`
fills, where the theme supplies a contrasting foreground.

### Theme behavior

- Default preference: `system`; resolve from `prefers-color-scheme`.
- Settings → Appearance offers a radio group: **System** (with current resolved value), **Light**, and **Dark**.
- Selecting Light or Dark persists a user override. Selecting System clears the override.
- No theme switcher belongs in the app bar or shopping interface.
- Light and dark modes preserve information hierarchy and color roles. Dark mode uses blue-charcoal surfaces, never pure black.

### Spacing, shape, and surfaces

- **Base unit:** 4px.
- **Scale:** 2, 4, 8, 12, 16, 24, 32, 48, 64px.
- **Density:** Comfortable in recipe/detail views; compact but touch-safe in shopping mode.
- **Radius:** 4px for inputs and small controls; 6–8px for buttons and menu rows; 12px for cards/dialogs; full only for badges and avatars.
- **Borders:** Default to a 1px neutral border. Avoid decorative shadows; use a subtle shadow only to establish a floating layer.

## Application shell

Use the official shadcn/ui sidebar component and its supplied primitives. Do not recreate an approximation with custom flex markup.

- Wrap the application with `SidebarProvider`.
- Use `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarFooter`, `SidebarRail`, `SidebarInset`, and `SidebarTrigger` in their intended composition.
- Desktop uses a left sidebar that can collapse to icons. Mobile uses shadcn’s off-canvas sheet behavior.
- Keep the header and footer sticky and only the content region scrollable.
- Sidebar groups: **Cook this week** (`Shopping run`, `Discover`, `My recipes`) and **Your lists** (membership-scoped lists plus `New list`).
- Use the active menu state and tokenized `--sidebar-*` variables. The sidebar stays neutral; Cobalt appears only for an active item or focus state.
- Settings and account live in the sticky sidebar footer/user menu. Theme selection is inside Settings → Appearance.

The shadcn sidebar documents the expected composition, icon-collapse, mobile behavior, and theme variables: <https://ui.shadcn.com/docs/components/base/sidebar>.

## Component rules

- Use shadcn/ui primitives before inventing a component. Compose primitives when a product-specific pattern is needed.
- One screen has one obvious primary action. Use a Cobalt filled button for it; prefer outline, ghost, or text actions for all other actions.
- Use Marigold as an emphasis signal, not as a second primary CTA competing with Cobalt.
- Grocery rows must keep quantity, unit, ingredient, state, category, and provenance legible at narrow widths. Quantities use `DM Mono` and tabular numerals.
- Expose a contribution breakdown in a `Popover`, `Sheet`, or expandable detail—not a cryptic tooltip-only experience.
- Manual overrides show both the calculated requirement and shopping amount, along with a one-action reset.
- Destructive structural changes explain the list-wide impact and require confirmation through `AlertDialog`.
- Use skeletons for recipe search and initial loads; preserve the layout of list rows while loading.
- Empty states name the next useful action and present it once.

## Accessibility and responsive rules

- Meet WCAG 2.2 AA contrast for normal text and controls. Check actual foreground/background pairs, including dark mode and disabled states.
- Keep focus rings visible: Cobalt ring on light surfaces; a high-contrast Cobalt/light-blue treatment on dark surfaces.
- Use text, icon, shape, or position alongside color for every state and status.
- Touch targets are at least 44 × 44px. A dense grocery row may be visually shorter only when its interactive target retains that minimum.
- Support keyboard operation for all navigation, lists, dialogs, reordering, and theme selection. Keep shadcn defaults unless a tested product need requires change.
- On mobile, prioritize the shopping run. The sidebar is off-canvas; do not compress desktop navigation into a permanent narrow rail.
- Respect `prefers-reduced-motion`.

## Motion

- Motion is functional and restrained: 150–200ms for button, menu, and checkbox feedback; up to 250ms for sheet/sidebar transitions.
- Use `ease-out` entering, `ease-in` exiting, and `ease-in-out` for moves.
- A state change should make a user more certain of what happened. Do not use decorative motion.

## Decisions log

| Date | Decision | Rationale |
| --- | --- | --- |
| 2026-09-09 | Prepared utility visual direction | Gives a serious cooking tool warmth without sacrificing trust and clarity. |
| 2026-09-09 | Cobalt + Marigold color system | Punchy, contrasting, color-vision-conscious signals. |
| 2026-09-09 | Official shadcn sidebar | Familiar, composable interaction model for an application shell. |
| 2026-09-09 | System-first theme preference | Matches device expectations while preserving user control in settings. |
| 2026-09-10 | Market Check brand mark | Makes the grocery checklist the primary identity while retaining a restrained fresh-food cue. |
