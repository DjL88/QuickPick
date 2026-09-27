import { describe, expect, it } from 'vitest';
import { PickingEngine } from '../packages/picking-engine/src/index.js';
import { createNestedPickingOrder } from '../packages/mock-deliverect/src/qp02-nested-fixture.js';

describe('QP-03 picking engine efficiency flows', () => {
  it('makes group Pick All all-or-nothing when any remaining physical child is unsafe', () => {
    const order = createNestedPickingOrder();
    const deal = order.groups!.find((group) => group.type === 'MEAL_DEAL')!;

    const result = PickingEngine.pickAllSafeGroup(order, deal.id);

    expect(result.success).toBe(false);
    expect(result.changedItemIds).toEqual([]);
    expect(result.blockReasons?.some((reason) => reason.includes('scale weighing'))).toBe(true);
    expect(result.blockReasons?.some((reason) => reason.includes('age verification'))).toBe(true);
    expect(result.order.items.every((item) => item.status === order.items.find((source) => source._id === item._id)?.status)).toBe(true);
  });

  it('bulk-picks a nested modifier group when every remaining child is safe', () => {
    const order = createNestedPickingOrder();
    const modifierGroup = order.groups!.find((group) => group.type === 'MODIFIER_GROUP')!;

    const result = PickingEngine.pickAllSafeGroup(order, modifierGroup.id);

    expect(result.success).toBe(true);
    expect(result.changedItemIds).toEqual(['item_modifier_demo']);
    const modifier = result.order.items.find((item) => item._id === 'item_modifier_demo')!;
    expect(modifier.status).toBe('PICKED');
    expect(modifier.pickedQuantity).toBe(1);
  });

  it('builds a deterministic ambient-to-chilled-to-frozen route grouped by aisle', () => {
    const order = createNestedPickingOrder();
    const cookies = order.items.find((item) => item._id === 'item_standalone_cookies_06')!;
    cookies.temperature = 'FROZEN';
    cookies.aisle = 'Aisle 9';

    const route = PickingEngine.buildRoute(order);
    const routed = route.stops.map((stop) => order.items.find((item) => item._id === stop.itemId)!);

    const temperatures = routed.map((item) => item.temperature || 'UNASSIGNED');
    const firstChilled = temperatures.indexOf('CHILLED');
    const firstFrozen = temperatures.indexOf('FROZEN');

    expect(firstChilled).toBeGreaterThan(0);
    expect(firstFrozen).toBeGreaterThan(firstChilled);
    expect(route.sections[0].label).toContain('AMBIENT');
    const firstUnassigned = temperatures.indexOf('UNASSIGNED');
    if (firstUnassigned >= 0) {
      expect(firstUnassigned).toBeGreaterThan(firstFrozen);
    }

    const ambientAisles = routed
      .filter((item) => item.temperature === 'AMBIENT')
      .map((item) => item.aisle)
      .filter(Boolean);
    expect(ambientAisles[0]).toBe('Aisle 1');
  });

  it('merges identical batch products into tote put instructions without mutating orders', () => {
    const a = createNestedPickingOrder();
    const b = structuredClone(a);
    b._id = 'deliv_ord_qp02_bundle_demo_b';
    b.channelOrderId = 'DELIVEROO-MD-8822';
    b.channelOrderDisplayId = '#DLV-8822';
    b.items = b.items.map((item) => ({ ...item, _id: `b_${item._id}` }));
    b.groups = undefined;

    const plan = PickingEngine.buildBatchTotePlan([a, b]);
    const cookieStop = plan.stops.find((stop) => stop.plu === '504433');

    expect(plan.orders).toEqual([
      { orderId: a._id, toteId: 'A' },
      { orderId: b._id, toteId: 'B' },
    ]);
    expect(cookieStop).toBeDefined();
    expect(cookieStop?.puts.map((put) => put.toteId)).toEqual(['A', 'B']);
    expect(cookieStop?.puts.map((put) => put.quantity)).toEqual([2, 2]);
    expect(a.items.find((item) => item.plu === '504433')?.status).toBe('PENDING');
  });

  it('splits the demo order into explicit temperature zones', () => {
    const order = createNestedPickingOrder();
    const cookies = order.items.find((item) => item._id === 'item_standalone_cookies_06')!;
    cookies.temperature = 'FROZEN';

    const plan = PickingEngine.buildZonePlan(order);

    expect(plan.zones.map((zone) => zone.zone)).toEqual(
      expect.arrayContaining(['AMBIENT', 'CHILLED', 'FROZEN'])
    );
    expect(plan.zones.find((zone) => zone.zone === 'FROZEN')?.itemIds).toContain(cookies._id);
  });

  it('supports conflict-safe local undo and refuses to overwrite later state', () => {
    const before = createNestedPickingOrder();
    const transition = PickingEngine.declareUnit(before, 'item_standalone_cookies_06');

    expect(transition.success).toBe(true);
    expect(transition.order.items.find((item) => item._id === 'item_standalone_cookies_06')?.pickedQuantity).toBe(1);

    const token = PickingEngine.createUndoToken(before, transition)!;
    const undone = PickingEngine.undo(transition.order, token);

    expect(undone.success).toBe(true);
    expect(undone.order.items.find((item) => item._id === 'item_standalone_cookies_06')?.pickedQuantity || 0).toBe(0);

    const changedAfter = structuredClone(transition.order);
    changedAfter.items.find((item) => item._id === 'item_bundle_sandwich_01')!.status = 'PICKED';
    const refused = PickingEngine.undo(changedAfter, token);

    expect(refused.success).toBe(false);
    expect(refused.message).toContain('changed');
  });

  it('turns engine transitions into concise audit events', () => {
    const order = createNestedPickingOrder();
    const transition = PickingEngine.declareUnit(order, 'item_standalone_cookies_06');
    const log = PickingEngine.toAuditLog(order._id, 'Alex Turner', transition);

    expect(log.orderId).toBe(order._id);
    expect(log.actor).toBe('Alex Turner');
    expect(log.action).toBe('ITEM_UNIT_DECLARED');
    expect(log.details?.changedItemIds).toEqual(['item_standalone_cookies_06']);
  });
});
