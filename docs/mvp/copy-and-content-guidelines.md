# Platter Copy and Content Guidelines

## Voice

Platter is a competent kitchen partner: practical, calm, and clear about the work it did. It helps people make a plan and trust the result.

- **Concrete:** name the ingredient, recipe, amount, person, or consequence.
- **Direct:** use active verbs and short sentences.
- **Warm, not cute:** light food language is welcome; jokes, puns, and cheerleading are not needed to make the product friendly.
- **Honest:** surface calculations, uncertainty, and manual overrides plainly.

## Product vocabulary

Use these words consistently.

| Term | Meaning | UI guidance |
| --- | --- | --- |
| Recipe | A saved version of a dish and its ingredients | `Recipe` is always a countable noun. |
| List | A persistent shared space, such as Family | Use in navigation and invitations. |
| Shopping run | The active recipe selections and derived grocery checklist in one list | Prefer `this week` or `shopping run` in explanatory copy; `cart` may be used only when a familiar short label helps. |
| Recipe selection | A recipe added to a run for a stated number of people | Usually expose as a recipe card or row, not jargon in casual UI. |
| Calculated requirement | The total derived from selected recipes | Use in detail and override contexts. |
| Shopping amount | What the user intends to buy after any adjustment | Use when a calculation differs from the practical purchase. |
| Already have | An all-or-nothing decision that no purchase is needed | Do not call this “in pantry”; Platter does not maintain inventory. |
| Purchased | An item checked off while shopping | Do not conflate with `Already have`. |
| Contribution | The portion of an item supplied by a recipe or manual addition | Explain with a readable breakdown. |

## Action labels

Prefer a verb plus the user’s intended outcome.

| Use | Avoid |
| --- | --- |
| Add to this week | Add to cart |
| Review at home | Pantry check |
| Mark already have | Remove from list |
| Start shopping | Begin / Go |
| Add grocery item | Add item |
| Reset to calculated amount | Reset |
| Invite to Family | Send |
| Complete shopping run | Finish |

## Trust copy

Recipe calculation, merging, and synchronization are the product’s core promises. State what changed and why.

| Situation | Preferred copy |
| --- | --- |
| Merge | `3 yellow onions combined from Tacos and Curry.` |
| Override retained after recalculation | `Your shopping amount stays at 2 lb. Your selected recipes now call for 3 lb.` |
| Already have | `Marked already have. It’s hidden from your buy view.` |
| Restore | `Added back to your buy view.` |
| Imported data needs correction | `We preserved the safe recipe facts we could extract. Add or correct the missing fields before saving.` |
| Offline operation | `Saved on this device. We’ll sync it when you’re back online.` |
| Reconciliation | `This item changed while you were offline. Showing the latest shared version.` |
| Shared destructive change | `Removing Tacos will remove 6 grocery contributions from the Family run.` |

Avoid vague confirmation such as `Updated`, `Success`, `Conflict detected`, or `Something changed` when Platter can name the object and consequence.

## Recipe and source content

- Attribute imported recipes with the source name and a source link wherever a recipe is presented in detail.
- Preserve original ingredient wording where normalization confidence is low.
- Explain public import restrictions without legalistic filler: `This source does not permit an image here. The recipe link is still available.`
- Keep image source, creator, license or permission, and rights status separate from recipe attribution; unknown rights must remain explicit.
- Treat nutrition values as optional informational data, label their basis (such as per person), and do not make health or dietary claims from them.
- Do not present a scraped recipe as authored by Platter.
- Write concise procedural instructions; do not reproduce editorial storytelling from a source.
- Hosted policy pages describe product behavior, not legal advice; keep
  jurisdiction-specific obligations, contacts, and moderation processes
  explicitly configurable by the operator.

## States and errors

- **Empty state:** identify the absence and give the one next action. Example: `Your Family run is empty. Choose a recipe to start this week’s list.`
- **Validation:** identify the field and repair. Example: `Enter how many people you’re cooking for.`
- **Destructive confirmation:** name the result before the action. Example: `Delete “Weeknight curry”? It will stay available in completed-run history.`
- **Permission boundary:** say what is permitted and who can do it. Example: `Only list owners can remove members.`
- **Loading:** use the component’s skeleton rather than a prose status unless the wait is long enough to require an explanation.

## Microcopy mechanics

- Sentence case for buttons, labels, and headings.
- Use numerals for quantities and units: `1 lb`, `2½ cups`, `3 onions`.
- Use `people`, not `servings`, when asking a user to scale a recipe: `How many people are you cooking for?`
- Write dates in the user’s locale; never embed a U.S.-only format as product copy.
- Use the serial comma only when it removes ambiguity.
- Do not use exclamation marks for routine success states.
- Keep a label stable when state changes if its location is stable; add a clear state description rather than changing vocabulary unpredictably.
