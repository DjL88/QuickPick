# QP-05 HeadsUp + printer/device baton

Branch: `qp/05-headsup-devices`  
Base: `qp/04-mobile-picker-ui` at `a56c53c68a8c8317c9f909883c60a8c0d778dfb9`

David-Victor issue #326 was checked first. The LTx closeout remains active, so this worker did not touch David-Victor.

## Implemented

- HeadsUp display for tablet/desktop packing desks with five lanes: New, Picking, Waiting / Approval, Ready and Exceptions.
- Large SLA timers, channel/order identity, line progress, picker assignment, bundle/group count, substitution/removal badges and exception emphasis.
- Responsive horizontal board on tablets and five-column layout on wide desktop screens.
- Touch-sized actions; opening a New order starts it, while existing orders can be reopened without replaying Start.
- Existing app-wide SSE new-order sound remains the audible alert path so HeadsUp does not double-chime. SLA/exception warnings are visual + aria-live.
- Printer seam: `PrinterProvider`, `MockPrinterProvider`, receipt, tote-label and bag-label purposes, and demo settings/test-print UI.
- No hardware command is sent. ESC/POS over LAN, Bluetooth and Android/iOS native bridges are documented only as future adapter types.
- W4 cohesion fixes included: groups are passed into `SwipeCardPicker`; list mode no longer invents aisle/bay values; list-mode Pick All uses the shared safety blocker.

## Merge review

- `main` is still the original demo baseline.
- QP-02 is ahead of main with no CI.
- QP-03 is independently ahead of QP-02 and contains the shared picking engine.
- QP-04 PR #1 is a draft targeting QP-02 and has no GitHub Actions/status checks.
- Because exact-head CI does not exist yet, **nothing was merged**. Do not treat mergeability as verification.
- This QP-05 branch intentionally depends on QP-04 rather than flattening the stack.

## Future printer adapters

Keep the provider boundary. Add real adapters only after testing representative devices:
1. ESC/POS network adapter for supported LAN receipt printers.
2. Bluetooth/BLE adapter through a native mobile bridge where browser APIs are insufficient.
3. Android/iOS native bridge adapter for USB/Bluetooth/system-print paths.
4. Optional label-printer adapter for tote/bag labels.

Do not claim cross-platform hardware support until each transport/device combination is proven.

## Verification to run in AI Studio/local

```bash
bun install
bun run lint
bun run test
bun run build
```

QuickPick currently has no `.github/workflows` directory, so there is no remote exact-head CI to report. After local verification, add CI before merging the dependent stack.

## Recommended dependency order

1. Verify QP-02.
2. Rebase/merge QP-03 onto verified QP-02.
3. Rebase QP-04 onto QP-03 so the UI uses the shared engine rather than parallel safety logic.
4. Rebase this QP-05 branch onto that combined head.
5. Run exact-head lint/test/build and only then merge.
