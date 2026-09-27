# QP-05 HeadsUp + printer/device baton

Branch: `qp/05-headsup-devices`  
Current head before this documentation correction: `36f8bd41d767d0a189e123c90d6371bf6b4105f5`  
Base: `qp/04-mobile-picker-ui` at `a56c53c68a8c8317c9f909883c60a8c0d778dfb9`

David-Victor issue #326 was checked first. The LTx closeout remains active, so this worker made no David-Victor changes.

## Implemented

- Standalone HeadsUp display at `/headsup` for tablet/desktop packing desks.
- Five live lanes: New, Picking, Waiting / Approval, Ready and Exceptions.
- Large SLA timers, channel/order identity, line progress, picker assignment, bundle/group count, substitution/removal badges and exception emphasis.
- Responsive horizontal board on tablets and five-column layout on wide desktop screens.
- Touch-sized controls and a live order detail drawer.
- SSE new-order alerts reuse the existing QuickPick sound so HeadsUp does not double-chime.
- Printer seam:
  - `PrinterProvider`
  - `MockPrinterProvider`
  - receipt, tote-label and bag-label purposes
  - demo settings/test-print UI
- No hardware command is sent. ESC/POS over LAN, Bluetooth and Android/iOS native bridges are documented only as future adapter types.
- Added focused HeadsUp/printer tests.
- Added a GitHub Actions workflow for Bun install, lint, test and build on PRs, main and `qp/**` pushes.

## Important integration facts

- W5 deliberately does **not** replace or reshape the phone picker. It is a separate large-screen shell backed by the same `/api/orders`, team and SSE endpoints.
- There is not yet a phone-app navigation button to `/headsup`; use the direct path for the demo.
- QP-04 still has three known phone integration tasks from its own baton:
  1. pass `groups={activeOrder.groups}` into `SwipeCardPicker`;
  2. remove the remaining list-mode invented `Aisle 1 / Bay 1` fallback;
  3. gate list-mode multi-quantity `All` with the shared Pick All safety rules.
- Those are intentionally left for the W3/W4 reconciliation rather than being claimed as part of W5.

## Merge review

- `main` is still the original demo baseline.
- QP-02 is ahead of main and is the shared grouped-order contract base.
- QP-03 is four commits ahead of QP-02 and contains the shared picking engine.
- QP-04 PR #1 is a draft based on QP-02 and therefore diverges from QP-03 by those four engine commits.
- QP-05 is two commits ahead of QP-04 and therefore inherits that dependency shape.
- No PR was merged. Mergeability is not verification.
- The connector blocked PR creation/comment writes during this run, so the authoritative W5 handoff is this branch + baton file.

## Future printer adapters

Keep the provider boundary. Add real adapters only after testing representative devices:
1. ESC/POS network adapter for supported LAN receipt printers.
2. Bluetooth/BLE adapter through a native mobile bridge where browser APIs are insufficient.
3. Android/iOS native bridge adapter for USB/Bluetooth/system-print paths.
4. Optional label-printer adapter for tote/bag labels.

Do not claim cross-platform hardware support until each transport/device combination is proven.

## Verification

A local attempt to clone/install/run verification failed before checkout because the execution environment could not resolve `github.com`. The GitHub connector also reports no exact-head statuses/workflow runs yet for the W5 head.

Run in AI Studio/local:

```bash
bun install --frozen-lockfile
bun run lint
bun run test
bun run build
```

Do not merge until all four commands are green on the reconciled exact head.

## Recommended dependency order

1. Verify QP-02.
2. Rebase/merge QP-03 onto verified QP-02.
3. Rebase QP-04 onto QP-03 and complete the three phone integration tasks above.
4. Rebase QP-05 onto that combined head.
5. Run exact-head lint/test/build and merge only when green.
