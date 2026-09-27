# QP-04 mobile UI baton

Branch: qp/04-mobile-picker-ui
Base: qp/02-order-groups at 034a4fc27054b306a3dd0c469057da6460030b66

David-Victor issue #326 was checked first. LTx closeout work is still active, so this worker made no David-Victor changes.

Implemented:
- grouped deal/bundle/modifier/upsell progress UI
- safe bundle Pick All using shared getPickAllBlockReasons rules
- safe multi-quantity Pick All
- component role, substitution and sync-state context
- no fake aisle/expected-weight presentation
- larger phone touch targets and sticky pick actions
- coarse-pointer, reduced-motion and device dark-mode polish

Deliberate limits:
- App.tsx still needs groups={activeOrder.groups} passed to SwipeCardPicker to populate the horizontal group rail. Per-item group progress and safe bundle Pick All already work from item.groupId.
- Bundle Pick All uses existing per-line onPickUnit; no undocumented provider bulk endpoint was invented.
- No provider undo/unpick mutation was invented.
- HeadsUp desktop remains Worker 5.
- React Router and Playwright are not installed, so this pass did not create a half-migrated router or an unrunnable test suite.

Verification:
QuickPick currently has no .github/workflows directory, so this branch has no CI. This environment cannot resolve github.com from the shell, so lint, test and build were not run here. Run all three in AI Studio/local before merging.

Next:
Wire the missing groups prop, run install/lint/test/build, fix any TypeScript/Tailwind issues, then exercise the QP-02 grouped fixture at a phone viewport. Confirm weighted, age, scan, verification and substitution-sensitive lines are never included in Pick All.
