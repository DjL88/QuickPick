import { describe, expect, it } from 'vitest';
import {
  getGroupLineIds,
  getPickAllBlockReasonsForLine,
  getPickingLineGroups,
  isPickingLinePickable,
} from '../packages/contracts/src/index.js';
import { createNestedPickingOrder } from '../packages/mock-deliverect/src/qp02-nested-fixture.js';
import { PickingEngine } from '../packages/picking-engine/src/index.js';

describe('QuickPick nested order contracts', () => {
  it('preserves standalone and nested parent/child relationships', () => {
    const order = createNestedPickingOrder();
    const deal = order.groups!.find((group) => group.type === 'MEAL_DEAL')!;
    const modifierGroup = order.groups!.find((group) => group.type === 'MODIFIER_GROUP')!;
    const customGroup = order.groups!.find((group) => group.type === 'CUSTOMISATION_GROUP')!;
    const upsellGroup = order.groups!.find((group) => group.type === 'UPSELL_GROUP')!;
    const addOnGroup = order.groups!.find((group) => group.type === 'ADD_ON_GROUP')!;
    const modifier = order.items.find((line) => line._id === 'item_modifier_demo')!;
    const standalone = order.items.find((line) => line.componentRole === 'STANDALONE')!;

    expect(deal.childGroupIds).toEqual([
      modifierGroup.id,
      customGroup.id,
      upsellGroup.id,
      addOnGroup.id,
    ]);
    expect(getGroupLineIds(modifierGroup)).toEqual([modifier._id]);
    expect(modifier.parentLineId).toBe('item_bundle_sandwich_01');
    expect(modifier.groupIds).toEqual([deal.id, modifierGroup.id]);
    expect(getPickingLineGroups(modifier, order.groups).map((group) => group.id)).toEqual([
      deal.id,
      modifierGroup.id,
    ]);
    expect(standalone.groupId).toBeUndefined();
  });

  it('keeps sensitive lines individual and blocks unsafe parent-group Pick All', () => {
    const order = createNestedPickingOrder();
    const safeModifier = order.items.find((line) => line._id === 'item_modifier_demo')!;
    const instruction = order.items.find((line) => line._id === 'item_bundle_no_mayo_note')!;
    const weighed = order.items.find((line) => line._id === 'item_bundle_apple_weighed_04')!;
    const restricted = order.items.find((line) => line._id === 'item_bundle_beer_restricted_05')!;
    const customerSub = order.items.find((line) => line._id === 'item_customer_sub_demo')!;

    expect(isPickingLinePickable(safeModifier)).toBe(true);
    expect(getPickAllBlockReasonsForLine(safeModifier, order.groups)).toEqual([]);
    expect(isPickingLinePickable(instruction)).toBe(false);
    expect(getPickAllBlockReasonsForLine(weighed, order.groups)).toContain('Requires scale weighing');
    expect(getPickAllBlockReasonsForLine(restricted, order.groups)).toContain('Requires 18+ age verification');
    expect(getPickAllBlockReasonsForLine(customerSub, order.groups)).toContain(
      'Customer-selected substitution requires individual verification'
    );

    const deal = order.groups!.find((group) => group.type === 'MEAL_DEAL')!;
    const result = PickingEngine.pickAllSafeGroup(order, deal.id);

    // QP-03 deliberately makes parent-group Pick All all-or-nothing: if any
    // remaining physical child needs individual handling, nothing is bulk-picked.
    expect(result.success).toBe(false);
    expect(result.changedItemIds).toEqual([]);
    expect(result.blockReasons?.some((reason) => reason.includes('scale weighing'))).toBe(true);
    expect(result.blockReasons?.some((reason) => reason.includes('age verification'))).toBe(true);
    expect(result.blockReasons?.some((reason) => reason.includes('Customer-selected substitution'))).toBe(true);

    // A fully-safe leaf group can still be bulk-picked independently.
    const modifierGroup = order.groups!.find((group) => group.type === 'MODIFIER_GROUP')!;
    const modifierResult = PickingEngine.pickAllSafeGroup(order, modifierGroup.id);
    expect(modifierResult.success).toBe(true);
    expect(modifierResult.changedItemIds).toEqual(['item_modifier_demo']);

    const modifier = modifierResult.order.items.find((line) => line._id === 'item_modifier_demo')!;
    expect(modifier.parentLineId).toBe('item_bundle_sandwich_01');
    expect(modifier.groupIds).toEqual([deal.id, 'grp_modifier']);
  });
});
