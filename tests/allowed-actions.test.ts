import { describe, it, expect } from 'vitest';
import { altie } from '../apps/server/src/altie.js';
import { ItemUnavailableAction } from '../packages/contracts/src/index.js';

describe('Allowed Actions Matrix Evaluation (itemUnavailableActions)', () => {
  it('enforces ITEM_AMENDMENT allowing quantity adjust', () => {
    const actions: ItemUnavailableAction[] = ['ITEM_AMENDMENT'];
    const res = altie.evaluateAllowedActions(actions);

    expect(res.canAdjust).toBe(true);
    expect(res.canRemove).toBe(false);
    expect(res.canReplace).toBe(false);
    expect(res.isStrict).toBe(true);
  });

  it('enforces ITEM_REMOVE allowing removal but disallowing replacement', () => {
    const actions: ItemUnavailableAction[] = ['ITEM_REMOVE'];
    const res = altie.evaluateAllowedActions(actions);

    expect(res.canRemove).toBe(true);
    expect(res.canReplace).toBe(false);
    expect(res.warning).toContain('Customer preferences disallow substitutions');
  });

  it('enforces ITEM_SUBSTITUTION and ITEM_SUBSTITUTION_CATALOG allowing replacements', () => {
    const actions1: ItemUnavailableAction[] = ['ITEM_SUBSTITUTION'];
    const res1 = altie.evaluateAllowedActions(actions1);
    expect(res1.canReplace).toBe(true);

    const actions2: ItemUnavailableAction[] = ['ITEM_SUBSTITUTION_CATALOG'];
    const res2 = altie.evaluateAllowedActions(actions2);
    expect(res2.canReplace).toBe(true);
  });

  it('handles CANCEL_ORDER offering order rejection', () => {
    const actions: ItemUnavailableAction[] = ['CANCEL_ORDER'];
    const res = altie.evaluateAllowedActions(actions);

    expect(res.canCancelOrder).toBe(true);
    expect(res.canReplace).toBe(false);
    expect(res.warning).toContain('full order cancellation');
  });

  it('allows adjust/remove/replace when itemUnavailableActions is absent but issues warning', () => {
    const res = altie.evaluateAllowedActions(undefined);

    expect(res.canAdjust).toBe(true);
    expect(res.canRemove).toBe(true);
    expect(res.canReplace).toBe(true);
    expect(res.isStrict).toBe(false);
    expect(res.warning).toContain('omitted by Deliverect');
  });

  it('never offers replacement when only remove/cancel is allowed', () => {
    const actions: ItemUnavailableAction[] = ['ITEM_REMOVE', 'CANCEL_ORDER'];
    const res = altie.evaluateAllowedActions(actions);

    expect(res.canReplace).toBe(false);
    expect(res.canRemove).toBe(true);
    expect(res.canCancelOrder).toBe(true);
  });
});
