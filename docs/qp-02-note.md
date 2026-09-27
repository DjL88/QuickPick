# QP-02 worker baton

Branch: `qp/02-order-groups`

QuickPick is still a demo/prototype. This branch does not change David-Victor because Audit IV issue #326 is still in active closeout.

## Added

- Canonical flat physical picking lines plus `PickingGroup` relationships.
- Group types for deal, bundle, modifier/customisation, upsell and add-on UI.
- Text-only customisations remain instructions instead of invented product lines.
- Customer-selected substitute candidates preserve quantity.
- Weighted, age-restricted, scan-required and individually verified lines are explicitly marked.
- `getGroupPickAllDecision` is conservative: a group only bulk-completes when every direct line is safe.
- Rich mock fixture covers deal components, a physical modifier, customisation instructions, upsell/add-on, selected substitute, weighted item and age check.

## Contract assumptions

The tolerant aliases used by `normalisePickingStructure` are internal demo semantics, not claims about the final Deliverect Generic Picking wire payload. Raw provider payloads remain the source of truth until Deliverect confirms exact nested shapes.

## Verification

The focused Vitest fixture tests are on this branch. This repository currently has no GitHub Actions workflow, so there is no remote lint/test/build result to claim. Run `npm run lint && npm test && npm run build` locally before merge.

## Next caller

Worker 4 can render `order.groups` as deal/bundle cards with progress and safe Pick All. Worker 3 can decide whether nested groups get their own Pick All button or a later recursively-safe parent action.
