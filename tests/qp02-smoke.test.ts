import { describe, expect, it } from 'vitest';
import { getGroupPickAllDecision, normalisePickingStructure } from '../packages/contracts/src/index.js';
import { groupedDemo } from '../packages/mock-deliverect/src/qp02-fixture.js';

describe('QP-02 grouped picking contracts', () => {
  it('keeps bundle children linked to one group', () => {
    expect(groupedDemo.items.map((item) => item._id)).toEqual(
      expect.arrayContaining(['demo-main', 'demo-side'])
    );
    const group = groupedDemo.groups.find((entry) => entry.type === 'BUNDLE');
    expect(group).toBeDefined();
    expect(group?.lineIds).toEqual(expect.arrayContaining(['demo-main', 'demo-side']));
  });

  it('blocks bulk completion when a child requires scanning', () => {
    const group = groupedDemo.groups.find((entry) => entry.type === 'BUNDLE');
    expect(group).toBeDefined();
    const decision = getGroupPickAllDecision(group!, groupedDemo.items);
    expect(decision.eligible).toBe(false);
    expect(decision.eligibleLineIds).toEqual(['demo-main']);
    expect(decision.blocked[0].reasons).toContain('SCAN_REQUIRED');
  });

  it('does not invent merchandising values for incomplete source lines', () => {
    const result = normalisePickingStructure(
      [{ _id: 'incomplete-line', name: 'Unknown source line' }],
      { orderId: 'demo-incomplete' }
    );
    expect(result.items[0]).toMatchObject({
      _id: 'incomplete-line',
      plu: '',
      price: 0,
      pickable: false,
      aisle: undefined,
      shelf: undefined,
    });
  });
});
