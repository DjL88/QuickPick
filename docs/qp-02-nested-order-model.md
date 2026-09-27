# QP-02 nested order-model baton

QuickPick remains a demo/prototype. This lane defines picker-domain semantics only; it does not claim provider production behaviour.

## Internal semantics

- `PickingLine` is the canonical domain name; `PickingItem` remains the compatibility alias used by the current UI.
- Physical product lines use `lineType: PRODUCT`. Instruction and group-parent rows stay in the model for context but are not pick mutations.
- `groupIds` records explicit nested membership outermost to innermost. `groupId` remains the nearest-group compatibility shortcut. `parentLineId` preserves the product relationship for selected modifiers/customisations.
- `PickingGroup.lineIds` is canonical when present; `itemIds` is retained for current callers.
- Nested group types cover deals/bundles, modifier/customisation groups, upsells and add-ons.
- A customer-selected substitution is a preference attached to the original line. QuickPick does not infer whether a provider has already approved/applied it.

## Pick All

A physical line can participate in Pick All only when every explicit/inherited group allows `SAFE_CHILDREN_ONLY` and the line does not require weighing, age checking, barcode/individual verification, or customer-substitution handling. Instruction/group-parent rows never participate.

This is deliberately conservative. A provider-specific group with unknown semantics should be represented as `UNKNOWN` or use `DISABLED` / `INDIVIDUAL_LINES`, not guessed.

## Demo adapters

`createNestedPickingOrder` layers the richer internal relationships over the existing Generic Picking-shaped fixture. Deliverect Generic Picking stays mock-only in this prototype. LTx direct remains a demo adapter and should map source fields into these shared contracts rather than invent new provider semantics.

The existing HMAC/replay tests remain the signed-flow source of truth; this change does not weaken or replace them.
