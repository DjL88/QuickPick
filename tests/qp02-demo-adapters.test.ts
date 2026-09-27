import { describe, expect, it } from 'vitest';
import {
  getPickAllBlockReasonsForLine,
  getPickingLineGroups,
  isPickingLinePickable,
} from '../packages/contracts/src/index.js';
import { verifyDeliverectHmac } from '../apps/server/src/crypto.js';
import { MockDeliverectServer } from '../packages/mock-deliverect/src/index.js';
import { createNestedPickingOrder } from '../packages/mock-deliverect/src/qp02-nested-fixture.js';
import {
  mapLtxDirectDemoOrder,
  mapMockGenericPickingOrder,
} from '../packages/mock-deliverect/src/demo-integrations.js';
import {
  normalizeDemoPickingGroups,
  normalizeDemoPickingLines,
} from '../packages/mock-deliverect/src/order-adapters.js';

describe('QP-02 demo adapter contracts', () => {
  it('preserves nested semantics after the existing signed-flow verification', () => {
    const raw = createNestedPickingOrder('loc_london_flagship');
    raw._id = 'qp02_signed_adapter_demo';
    const rawBody = JSON.stringify(raw);
    const mock = new MockDeliverectServer();
    const signature = mock.signPayload(rawBody, 'loc_london_flagship');

    const verification = verifyDeliverectHmac(
      rawBody,
      { 'x-deliverect-hmac-sha256': signature },
      'loc_london_flagship'
    );
    expect(verification.isValid).toBe(true);

    const order = mapMockGenericPickingOrder(JSON.parse(rawBody), {
      flags: { mockGenericPicking: true },
      now: new Date('2026-09-27T10:00:00.000Z'),
    });

    const deal = order.groups!.find((group) => group.type === 'MEAL_DEAL')!;
    const modifier = order.items.find((line) => line._id === 'item_modifier_demo')!;
    const instruction = order.items.find((line) => line._id === 'item_bundle_no_mayo_note')!;
    const weighed = order.items.find((line) => line._id === 'item_bundle_apple_weighed_04')!;
    const restricted = order.items.find((line) => line._id === 'item_bundle_beer_restricted_05')!;
    const customerSub = order.items.find((line) => line._id === 'item_customer_sub_demo')!;

    expect(order.metadata?.source).toBe('MOCK_DELIVERECT_GENERIC');
    expect(order.metadata?.prototypeOnly).toBe(true);
    expect(deal.childGroupIds).toEqual(['grp_modifier', 'grp_custom', 'grp_upsell', 'grp_addon']);

    expect(modifier.parentLineId).toBe('item_bundle_sandwich_01');
    expect(getPickingLineGroups(modifier, order.groups).map((group) => group.id)).toEqual([
      deal.id,
      'grp_modifier',
    ]);

    expect(instruction.lineType).toBe('INSTRUCTION');
    expect(isPickingLinePickable(instruction)).toBe(false);

    expect(weighed.isWeight).toBe(true);
    expect(weighed.minWeight).toBe(0.15);
    expect(weighed.maxWeight).toBe(0.35);
    expect(getPickAllBlockReasonsForLine(weighed, order.groups)).toContain('Requires scale weighing');

    expect(restricted.ageRestricted).toBe(true);
    expect(restricted.minimumAge).toBe(18);
    expect(getPickAllBlockReasonsForLine(restricted, order.groups)).toContain(
      'Requires 18+ age verification'
    );

    expect(customerSub.customerSelectedSubstitution?.name).toBe('Customer chosen alternative');
    expect(getPickAllBlockReasonsForLine(customerSub, order.groups)).toContain(
      'Customer-selected substitution requires individual verification'
    );
  });

  it('does not invent catalogue or store-location metadata for sparse source lines', () => {
    const [line] = normalizeDemoPickingLines([{
      _id: 'sparse_line',
      name: 'Sparse source line',
      quantity: 1,
      price: 0,
    }]);

    expect(line.componentRole).toBe('STANDALONE');
    expect(line.lineType).toBe('PRODUCT');
    expect(line.plu).toBe('');
    expect(line.gtin).toBeUndefined();
    expect(line.department).toBeUndefined();
    expect(line.aisle).toBeUndefined();
    expect(line.shelf).toBeUndefined();
    expect(line.temperature).toBeUndefined();
    expect(line.weightUnit).toBeUndefined();
  });

  it('fails unknown group semantics closed instead of guessing safe Pick All behaviour', () => {
    const groups = normalizeDemoPickingGroups([{
      id: 'grp_unknown_provider',
      name: 'Provider-specific selection',
      type: 'SOMETHING_UNDOCUMENTED',
      lineIds: ['unknown_child'],
    }]);
    const [line] = normalizeDemoPickingLines([{
      _id: 'unknown_child',
      plu: 'KNOWN-IDENTITY',
      name: 'Unknown provider child',
      quantity: 1,
      price: 100,
      groupId: 'grp_unknown_provider',
      groupIds: ['grp_unknown_provider'],
    }]);

    expect(groups[0].type).toBe('UNKNOWN');
    expect(groups[0].pickAllPolicy).toBe('DISABLED');
    expect(groups[0].verificationPolicy).toBe('INDIVIDUAL_LINES');
    expect(getPickAllBlockReasonsForLine(line, groups)).toContain(
      'Group Provider-specific selection does not permit Pick All'
    );
  });

  it('maps LTx direct as a separate demo adapter while preserving parent/child relationships', () => {
    const order = mapLtxDirectDemoOrder({
      _id: 'ltx_direct_qp02',
      location: 'loc_london_flagship',
      customer: { name: 'Demo shopper' },
      groups: [{
        id: 'ltx_bundle',
        name: 'LTx direct bundle',
        type: 'BUNDLE',
        lineIds: ['ltx_parent', 'ltx_addon'],
        pickAllPolicy: 'SAFE_CHILDREN_ONLY',
      }],
      items: [
        {
          _id: 'ltx_parent',
          plu: 'PARENT-1',
          name: 'Bundle parent',
          quantity: 1,
          price: 500,
          lineType: 'GROUP_PARENT',
          componentRole: 'PARENT',
          groupId: 'ltx_bundle',
          groupIds: ['ltx_bundle'],
        },
        {
          _id: 'ltx_addon',
          name: 'Loose add-on',
          quantity: 1,
          price: 0,
          componentRole: 'ADD_ON',
          groupId: 'ltx_bundle',
          groupIds: ['ltx_bundle'],
          parentLineId: 'ltx_parent',
          isWeight: true,
          weightUnit: 'kg',
        },
      ],
    }, {
      flags: { ltxDirectDemo: true },
      now: new Date('2026-09-27T10:00:00.000Z'),
    });

    const addOn = order.items.find((line) => line._id === 'ltx_addon')!;
    expect(order.metadata?.source).toBe('LTX_DIRECT_DEMO');
    expect(order.metadata?.prototypeOnly).toBe(true);
    expect(addOn.parentLineId).toBe('ltx_parent');
    expect(addOn.plu).toBe('');
    expect(addOn.aisle).toBeUndefined();
    expect(getPickAllBlockReasonsForLine(addOn, order.groups)).toContain('Requires scale weighing');
  });

  it('keeps mock Generic Picking and LTx direct independently feature-gated', () => {
    expect(() =>
      mapMockGenericPickingOrder(
        { _id: 'disabled_generic', items: [] },
        { flags: { mockGenericPicking: false } }
      )
    ).toThrow('Mock Generic Picking adapter is disabled');

    expect(() =>
      mapLtxDirectDemoOrder(
        { _id: 'disabled_direct', items: [] },
        { flags: { ltxDirectDemo: false } }
      )
    ).toThrow('LTx direct demo adapter is disabled');
  });
});
