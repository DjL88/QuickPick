# QuickPick · LTx UI direction

QuickPick should feel like part of the LTx product family rather than a generic generated dashboard.

## Brand anchors

- Primary petrol: `#0D3944`
- Strong petrol: `#082B33`
- Soft brand tint: `#E8F0F2`
- Canvas: `#F5F7F7`
- Main ink: `#172126`
- Use the existing `/icon.svg` LTx trolley mark as the main product mark.
- Funnel Display is the preferred display face when available; body UI remains a highly readable sans stack.

## Interaction hierarchy

Every picker screen should have one obvious primary task.

1. Order / SLA context
2. Current physical item
3. Only the exception or bundle context needed now
4. Primary action

Avoid putting multiple equally prominent buttons in the same action row.

## Status colours

The LTx petrol colour identifies product/actions. Status colours keep their semantic meaning:

- Green: success / complete
- Amber: warning / waiting
- Red: exception / overdue

Do not colour component roles like a rainbow. Bundle roles are metadata, not status.

## Cards and spacing

- Primary radius: 16px
- Secondary radius: 12px
- Use quiet borders rather than heavy shadows
- Spacing should mostly follow 4 / 8 / 12 / 16 / 24
- Touch controls should be at least 48px on coarse pointers

## Bundle UI

A bundle should read as one object with nested, accountable children.

- Parent name + compact progress (for example `2/4 picked`)
- Component/modifier/customisation labels are visually quiet
- Text-only instructions remain notes, never fake PLUs
- Bulk picking remains guarded and uses hold-to-confirm

## HeadsUp

HeadsUp is a desktop/tablet operations board, not a stretched mobile screen.

- Petrol/dark LTx shell
- Calm columns: New, Picking, Approval, Ready, Exceptions
- Large SLA information
- Minimal badges
- Touch-friendly order actions
- Printer functions remain secondary tools

## Demo tools

Simulator, injected test orders, device-frame controls and install actions belong under the compact Demo menu. They should not visually compete with live picking.

## Guardrail

Design polish must not weaken:
- Pick All safety
- weight / age / scan verification
- substitution state
- offline/sync feedback
- parent/child bundle relationships
- honest display of missing source data
