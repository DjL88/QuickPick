# QP-02 demo adapter hardening baton

QuickPick remains a demo/prototype. David-Victor #326 was checked first and closeout/P0 work is still active, so this branch makes no David-Victor changes.

This pass adds conservative order adapters for simulated Generic Picking and LTx-direct demo input. They preserve standalone lines, nested deals/bundles, modifier/customisation groups, upsells/add-ons, parent/child links, text instructions, customer-selected substitutions, weighed items, age flags, barcode requirements and explicit individual-verification requirements.

Missing PLU, GTIN, department, aisle, shelf, temperature and weight data stays missing. Unknown group types become UNKNOWN. Unknown or missing Pick All policy fails closed to DISABLED plus INDIVIDUAL_LINES.

The simulated adapters are independently gated by QP_ENABLE_MOCK_GENERIC_PICKING and QP_ENABLE_LTX_DIRECT_DEMO. Their order metadata is marked prototypeOnly and records whether the source was MOCK_DELIVERECT_GENERIC or LTX_DIRECT_DEMO.

Pick All continues to use the shared contract validators. Weighed, age-restricted, scan-required, explicitly verified, customer-substitution and unresolved/unknown children remain individually handled. QP-03 parent-group Pick All remains all-or-nothing.

A focused test reuses the existing signed-flow verifier and mock signer before mapping the realistic nested QP-02 fixture. No live provider or cloud configuration is changed.

Verification target:

- bun install --frozen-lockfile
- bun run lint
- bun run test
- bun run build

Next best action after review is a separate small change that wires the existing QuickPick Express demo ingress to these normalisers.
