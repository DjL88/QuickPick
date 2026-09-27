# QP-03 worker baton

Branch: `qp/03-group-picking-engine`

QuickPick remains a demo/prototype. This worker did not touch David-Victor while Audit IV #326 remains active.

## Dependency

QP-03 is built on the current `qp/02-order-groups` head. Its functional diff against QP-02 is the shared engine module plus focused tests.

## Added

- Recursive progress across deal, bundle, modifier, customisation, upsell and add-on groups.
- Guarded Pick All planning. Any remaining scan, weight, age, verification or substitution-pending line blocks the parent bulk action.
- Hold-to-confirm metadata with a 650 ms default.
- Immutable bulk apply, short conflict-safe undo token, and audit events.
- Deterministic ambient -> chilled -> frozen route ordering with optional heavy-first and fragile-late hints.
- Route sections for aisle grouping.
- Batch merge planning with explicit tote placements.
- Lightweight ambient/chilled/frozen zone plans.

## Verification

Focused Vitest coverage is included and uses the QP-02 grouped demo fixture. This repository currently has no GitHub Actions workflow, and the tool container has no outbound package/GitHub network, so lint/test/build were not executed here.

Before merge run:

`bun run lint && bun run test && bun run build`

## Handoff

W4 should import `packages/contracts/src/picking-engine.ts` rather than duplicating group safety rules in the UI. W5 should verify the commands above and merge/retarget in dependency order after QP-02.
