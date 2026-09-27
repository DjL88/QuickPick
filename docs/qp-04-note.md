# QP-04: Mobile-First Picker UI & Order Groups Integration

## Overview
QuickPick by LTx is a high-speed, mobile-first retail grocery and restaurant order picking application compatible with the Deliverect Generic Picking API.

## Architecture & Data Contracts
- **Order Groups (`PickingGroup`)**:
  - Encapsulates meal deals, combos, and bundles.
  - Carries `pickAllPolicy: 'SAFE_CHILDREN_ONLY' | 'DISABLED' | 'NONE'`.
  - Maintains parent/child item tracking without inventing separate competing models.
- **Component Roles (`ComponentRole`)**:
  - `COMPONENT`: Core bundle item (e.g. main sandwich).
  - `MODIFIER`: Choice or variation option (e.g. side or craft beverage).
  - `CUSTOMISATION`: Preparation instructions or alterations (e.g. "No mayonnaise").
  - `UPSELL`: Upgraded items.
  - `ADD_ON`: Extra physical add-ons.
- **Text-Only Instructions**:
  - Flagged with `isTextInstruction: true`.
  - Rendered as informational customisation notes without creating fake PLUs or fake pickable deck cards.

## Safe Pick All Rules (`getPickAllBlockReasons`)
Pick All is strictly blocked if any item line:
1. Requires scale weighing (`isWeight: true`).
2. Requires 18+ age verification (`ageRestricted: true`).
3. Requires mandatory barcode scan (`requiresBarcodeScan: true`).
4. Requires explicit individual verification (`requiresIndividualVerification: true`).
5. Has active/pending substitution (`status === 'REPLACED' || syncState === 'PENDING'`).
6. Lacks source identity (`!plu && !channelItemId && !gtin`).
7. Is a non-pickable instruction line (`isTextInstruction: true`).
8. Belongs to a group where `pickAllPolicy !== 'SAFE_CHILDREN_ONLY'`.

## Honest Data Presentation
- No fake aisles or bays: If location data is missing, display `"Location not set"`.
- No fake expected weights: If expected weight is absent, display `"Weigh item"`.

## Touch Ergonomics & Accessibility
- Minimum touch target height: 48px on coarse touch pointers.
- Sticky bottom pick controls with clear viewport padding to prevent content clipping.
- System dark mode baseline and `prefers-reduced-motion` compliance.

## Proposed Future Route Split (QP-05+)
- `/` -> Queue View
- `/orders` -> Filtered Order Queue
- `/orders/:orderId/pick` -> Active Picker (Card & List modes)
- `/orders/:orderId/verify` -> Review & Courier Dispatch Modal
- `/settings` -> Store & Device Configuration
