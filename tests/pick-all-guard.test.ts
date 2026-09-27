import { describe, expect, it } from 'vitest';
import type { PickingGroup, PickingItem } from '../packages/contracts/src/index.js';
import {
  buildGroupPickAllPlan,
  buildItemPickAllFingerprint,
  isGroupPickAllPlanCurrent,
} from '../src/lib/pickAllGuard.js';

const group: PickingGroup = {
  id: 'meal-deal-1',
  name: 'Lunch Meal Deal',
  itemIds: ['sandwich', 'crisps', 'drink'],
  pickAllPolicy: 'SAFE_CHILDREN_ONLY',
};

function item(overrides: Partial<PickingItem>): PickingItem {
  return {
    _id: 'sandwich',
    plu: 'PLU-1',
    name: 'Sandwich',
    quantity: 1,
    price: 450,
    status: 'PENDING',
    groupId: group.id,
    ...overrides,
  };
}

describe('stale-safe Pick All planning', () => {
  it('plans only safe pending physical items', () => {
    const items = [
      item({ _id: 'sandwich', plu: 'PLU-1' }),
      item({ _id: 'crisps', plu: 'PLU-2', requiresBarcodeScan: true }),
      item({ _id: 'drink', plu: 'PLU-3', ageRestricted: true }),
    ];

    const plan = buildGroupPickAllPlan(group, items);

    expect(plan.eligibleItemIds).toEqual(['sandwich']);
    expect(plan.blockedItems.map((entry) => entry.itemId)).toEqual([
      'crisps',
      'drink',
    ]);
  });

  it('excludes text-only customisations from bulk-pick targets', () => {
    const note = item({
      _id: 'note',
      plu: '',
      channelItemId: undefined,
      gtin: [],
      name: 'No mayonnaise',
      componentRole: 'CUSTOMISATION',
      isTextInstruction: true,
    });

    const plan = buildGroupPickAllPlan(
      { ...group, itemIds: [...group.itemIds, 'note'] },
      [item({}), note]
    );

    expect(plan.eligibleItemIds).toEqual(['sandwich']);
    expect(plan.eligibleItemIds).not.toContain('note');
  });

  it('invalidates a held group plan if live state becomes substitution-sensitive', () => {
    const before = [
      item({ _id: 'sandwich', plu: 'PLU-1' }),
      item({ _id: 'crisps', plu: 'PLU-2' }),
    ];

    const plan = buildGroupPickAllPlan(group, before);

    const after = before.map((entry) =>
      entry._id === 'crisps'
        ? { ...entry, syncState: 'PENDING' as const }
        : entry
    );

    expect(isGroupPickAllPlanCurrent(plan, group, after)).toBe(false);
    expect(buildGroupPickAllPlan(group, after).eligibleItemIds).toEqual([
      'sandwich',
    ]);
  });

  it('changes the standalone guard fingerprint when a line becomes unsafe', () => {
    const safe = item({});
    const unsafe = { ...safe, isWeight: true };

    expect(buildItemPickAllFingerprint(safe, group)).not.toBe(
      buildItemPickAllFingerprint(unsafe, group)
    );
  });
});
