import { describe, expect, it } from 'vitest';
import { getGroupPickAllDecision, normalisePickingStructure } from '../packages/contracts/src/index.js';
import { groupedDemo } from '../packages/mock-deliverect/src/qp02-fixture.js';

describe('QP-02 grouped picking contracts', () => {
  it('preserves deal children and nested modifier/add-on relationships', () => {
    expect(groupedDemo.items.map((item) => item._id)).toEqual(
      expect.arrayContaining([
        'demo-main',
        'demo-side',
        'demo-weight',
        'demo-age',
        'demo-sauce',
        'demo-fruit',
        'demo-dip',
      ])
    );

    const deal = groupedDemo.groups.find((entry) => entry.type === 'DEAL');
    expect(deal).toBeDefined();
    expect(deal?.lineIds).toEqual(
      expect.arrayContaining(['demo-main', 'demo-side', 'demo-weight', 'demo-age'])
    );

    const modifiers = groupedDemo.groups.find((entry) => entry.type === 'MODIFIER_GROUP');
    const customisations = groupedDemo.groups.find((entry) => entry.type === 'CUSTOMISATION_GROUP');
    const upsells = groupedDemo.groups.find((entry) => entry.type === 'UPSELL_GROUP');
    const addOns = groupedDemo.groups.find((entry) => entry.type === 'ADD_ON_GROUP');

    expect(modifiers?.parentLineId).toBe('demo-main');
    expect(modifiers?.instructions.map((entry) => entry.label)).toContain('No mayonnaise');
    expect(customisations?.instructions.map((entry) => entry.label)).toContain('Cut in half');
    expect(upsells?.lineIds).toContain('demo-fruit');
    expect(addOns?.lineIds).toContain('demo-dip');
  });

  it('preserves customer-selected substitute quantities', () => {
    const drink = groupedDemo.items.find((item) => item._id === 'demo-side');
    expect(drink?.substitutionPreference).toBe('CUSTOMER_SELECTED');
    expect(drink?.customerSelectedSubstitutes?.[0]).toMatchObject({
      itemId: 'demo-side-alt',
      plu: 'SIDE-2',
      quantity: 1,
    });
  });

  it('blocks Pick All when children need scan, weight or age verification', () => {
    const deal = groupedDemo.groups.find((entry) => entry.type === 'DEAL');
    expect(deal).toBeDefined();

    const decision = getGroupPickAllDecision(deal!, groupedDemo.items);
    expect(decision.eligible).toBe(false);
    expect(decision.eligibleLineIds).toEqual(['demo-main']);
    expect(decision.blocked.find((entry) => entry.lineId === 'demo-side')?.reasons)
      .toContain('SCAN_REQUIRED');
    expect(decision.blocked.find((entry) => entry.lineId === 'demo-weight')?.reasons)
      .toContain('WEIGHT_REQUIRED');
    expect(decision.blocked.find((entry) => entry.lineId === 'demo-age')?.reasons)
      .toEqual(expect.arrayContaining(['AGE_CHECK_REQUIRED', 'INDIVIDUAL_VERIFICATION']));
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
