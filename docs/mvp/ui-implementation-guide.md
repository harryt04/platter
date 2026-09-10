# UI Implementation Guide for Agents

Read [DESIGN.md](../../DESIGN.md) and [Copy and Content Guidelines](copy-and-content-guidelines.md) before implementing or changing product UI.

## Delivery loop

1. Identify the user task, its current state, and the one primary action for the screen.
2. Start with a shadcn/ui primitive or the official sidebar composition; add product-specific structure only around it.
3. Use design tokens and semantic Tailwind/shadcn variables. Do not introduce an ad hoc hex color, font, radius, or spacing value for a one-off screen.
4. Build all states: default, focus, hover where useful, disabled, loading, empty, validation/error, and dark mode.
5. Verify at a narrow mobile width and desktop width, with keyboard navigation and both resolved themes.
6. Check copy against the content guide, especially calculations, overrides, shared changes, and offline feedback.

Completion means the UI uses the system, communicates state without color alone, and preserves the intended action at every breakpoint—not merely that the default screen renders.

## Required stack decisions

- Use Tailwind CSS and installed shadcn/ui components.
- Build the application shell with shadcn’s `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarFooter`, `SidebarRail`, `SidebarInset`, and `SidebarTrigger`.
- Use shadcn’s mobile sidebar behavior instead of implementing a separate mobile nav.
- Keep design tokens in the global theme layer; map them to shadcn semantic variables and `--sidebar-*` variables.
- Implement theme preference as `system | light | dark`. `system` is the initial and fallback preference. Place the radio-group setting at Settings → Appearance, not in the app bar.

## Screen hierarchy

### Shopping run

- The page title is the current mode (`Review at home` or shopping context) and the current list name is visible nearby.
- A grocery row exposes ingredient name, shopping amount, category, state, and a path to contribution detail.
- Use clear controls for `Already have` and `Purchased`; retain their distinct meanings.
- Preserve the calculated amount when a user overrides shopping amount. Show a reset control only when an override exists.
- Confirm a recipe removal that changes other members’ shared run.

### Recipes

- Recipe title and imagery carry the editorial layer; the rest of the view remains a tool.
- Ingredient quantity and unit are `DM Mono` with tabular numerals.
- Source, attribution, version, and import status are factual metadata—not buried in a tooltip.

### Settings

- Settings are a normal app route, reachable from the account/footer area of the sidebar.
- Theme is a labeled radio group with a short description of System’s resolved behavior.
- Save immediately for low-risk preferences such as theme, then provide concise confirmation only when needed.

## Interaction rules

- A primary button starts the key forward task; use Cobalt. Do not give a single task area two filled CTAs.
- Secondary actions use outline, ghost, link, or menu patterns. Marigold is a rare emphasis signal and never replaces semantic warning/error treatment.
- Use `AlertDialog` for irreversible deletion or broad shared impact. The confirmation names the affected object and consequence.
- Use a `Sheet`, `Popover`, or expandable section for contribution breakdowns. A hover-only tooltip is insufficient on touch devices.
- Use optimistic updates only when the UI can reconcile visibly and safely. Explain offline queueing and later reconciliation in user terms.
- Reordering needs a pointer path and an equivalent keyboard path.

## Token contract

When defining the theme, supply light and `.dark` values for the semantic background, foreground, card, border, primary, secondary, muted, destructive, ring, sidebar background, sidebar foreground, sidebar accent, and sidebar border variables.

- Cobalt is the primary/focus/active-navigation role.
- Marigold’s foreground is dark ink in both modes.
- Dark surfaces are blue-charcoal, not black.
- Semantic success, warning, and destructive colors retain text/icon/shape support; do not encode status with hue alone.

## Review checklist

- [ ] The layout uses shadcn patterns and Design System tokens.
- [ ] The primary task is visible without scrolling on typical mobile viewports when feasible.
- [ ] Touch targets are at least 44 × 44px.
- [ ] Focus is visible and keyboard movement is logical.
- [ ] The component works in light and dark themes.
- [ ] A color-blind or grayscale view still distinguishes state through text, icon, control state, or position.
- [ ] Empty, loading, error, offline, and shared-update states have intentional behavior and copy.
- [ ] Quantities, totals, manual overrides, and recipe contributions are not hidden or ambiguous.
