import { describe, it, expect } from 'vitest';
import {
  PickingGroup,
  PickingItem,
  getPickAllBlockReasons,
} from '../packages/contracts/src/index.js';
import { createQP02GroupedOrder } from '../packages/mock-deliverect/src/qp02-fixture.js';

describe('QP-02 / QP-04: Group Data Wiring & Safe Pick All Rules', () => {
  const sampleGroup: PickingGroup = {
    id: 'grp_test_01',
    name: 'Lunch Meal Deal',
    type: 'MEAL_DEAL',
    pickAllPolicy: 'SAFE_CHILDREN_ONLY',
    itemIds: ['item_1', 'item_2', 'item_3', 'item_4', 'item_5'],
  };

  it('allows Pick All for normal safe components', () => {
    const safeItem: PickingItem = {
      _id: 'item_1',
      groupId: 'grp_test_01',
      componentRole: 'COMPONENT',
      plu: '502110',
      name: 'Baguette Sandwich',
      quantity: 1,
      price: 450,
      status: 'PENDING',
    };

    const reasons = getPickAllBlockReasons(safeItem, sampleGroup);
    expect(reasons).toHaveLength(0);
  });

  it('blocks Pick All for scale-weighed items', () => {
    const weighedItem: PickingItem = {
      _id: 'item_2',
      groupId: 'grp_test_01',
      componentRole: 'COMPONENT',
      plu: '4011',
      name: 'Fresh Bananas',
      quantity: 1,
      price: 180,
      isWeight: true,
      weightUnit: 'kg',
      expectedWeight: 1.2,
      status: 'PENDING',
    };

    const reasons = getPickAllBlockReasons(weighedItem, sampleGroup);
    expect(reasons).toContain('Requires scale weighing');
  });

  it('blocks Pick All for 18+ age restricted items', () => {
    const ageRestrictedItem: PickingItem = {
      _id: 'item_3',
      groupId: 'grp_test_01',
      componentRole: 'MODIFIER',
      plu: '501999',
      name: 'Craft IPA 330ml Can',
      quantity: 1,
      price: 250,
      ageRestricted: true,
      minimumAge: 18,
      status: 'PENDING',
    };

    const reasons = getPickAllBlockReasons(ageRestrictedItem, sampleGroup);
    expect(reasons).toContain('Requires 18+ age verification');
  });

  it('blocks Pick All for non-pickable text customisation instructions', () => {
    const textInstructionItem: PickingItem = {
      _id: 'item_4',
      groupId: 'grp_test_01',
      componentRole: 'CUSTOMISATION',
      isTextInstruction: true,
      plu: '',
      name: 'No Mayonnaise / Extra Pickles',
      quantity: 1,
      price: 0,
      status: 'PENDING',
    };

    const reasons = getPickAllBlockReasons(textInstructionItem, sampleGroup);
    expect(reasons).toContain('Non-pickable text instruction');
  });

  it('blocks Pick All for items requiring barcode scan or individual verification', () => {
    const scanItem: PickingItem = {
      _id: 'item_5',
      groupId: 'grp_test_01',
      componentRole: 'UPSELL',
      plu: '735901',
      name: 'Cold Brew Coffee',
      quantity: 1,
      price: 300,
      requiresBarcodeScan: true,
      requiresIndividualVerification: true,
      status: 'PENDING',
    };

    const reasons = getPickAllBlockReasons(scanItem, sampleGroup);
    expect(reasons).toContain('Requires physical barcode scan');
    expect(reasons).toContain('Requires individual item verification');
  });

  it('blocks Pick All when group policy is not SAFE_CHILDREN_ONLY', () => {
    const disabledGroup: PickingGroup = {
      ...sampleGroup,
      pickAllPolicy: 'DISABLED',
    };

    const normalItem: PickingItem = {
      _id: 'item_1',
      groupId: 'grp_test_01',
      componentRole: 'COMPONENT',
      plu: '502110',
      name: 'Baguette Sandwich',
      quantity: 1,
      price: 450,
      status: 'PENDING',
    };

    const reasons = getPickAllBlockReasons(normalItem, disabledGroup);
    expect(reasons).toContain('Group policy does not permit Pick All');
  });

  it('loads realistic QP-02 grouped bundle fixture correctly', () => {
    const order = createQP02GroupedOrder('loc_london_flagship');
    expect(order.groups).toBeDefined();
    expect(order.groups).toHaveLength(1);
    expect(order.groups![0].name).toBe('Artisan Lunch Meal Deal');
    expect(order.groups![0].type).toBe('MEAL_DEAL');
    expect(order.groups![0].pickAllPolicy).toBe('SAFE_CHILDREN_ONLY');

    const group = order.groups![0];
    const groupItems = order.items.filter((i) => i.groupId === group.id);

    // Verify component roles and types
    const sandwich = groupItems.find((i) => i._id === 'item_bundle_sandwich_01');
    const note = groupItems.find((i) => i._id === 'item_bundle_no_mayo_note');
    const crisps = groupItems.find((i) => i._id === 'item_bundle_crisps_02');
    const smoothie = groupItems.find((i) => i._id === 'item_bundle_drink_03');
    const apple = groupItems.find((i) => i._id === 'item_bundle_apple_weighed_04');
    const beer = groupItems.find((i) => i._id === 'item_bundle_beer_restricted_05');

    expect(sandwich?.componentRole).toBe('COMPONENT');
    expect(getPickAllBlockReasons(sandwich!, group)).toHaveLength(0);

    expect(note?.componentRole).toBe('CUSTOMISATION');
    expect(note?.isTextInstruction).toBe(true);
    expect(getPickAllBlockReasons(note!, group)).toContain('Non-pickable text instruction');

    expect(crisps?.componentRole).toBe('ADD_ON');
    expect(getPickAllBlockReasons(crisps!, group)).toHaveLength(0);

    expect(smoothie?.componentRole).toBe('UPSELL');
    expect(getPickAllBlockReasons(smoothie!, group)).toHaveLength(0);

    expect(apple?.isWeight).toBe(true);
    expect(getPickAllBlockReasons(apple!, group)).toContain('Requires scale weighing');

    expect(beer?.ageRestricted).toBe(true);
    expect(getPickAllBlockReasons(beer!, group)).toContain('Requires 18+ age verification');
  });
});
