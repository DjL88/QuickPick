import { PickingOrder } from '../../contracts/src/index.js';
import { createQP02GroupedOrder } from './qp02-fixture.js';

/**
 * Adds nested demo semantics to the base QP-02 fixture without changing the
 * Generic Picking-shaped fixture itself. This is intentionally a demo adapter:
 * unknown provider grouping stays explicit rather than being inferred.
 */
export function createNestedPickingOrder(locationId = 'loc_london_flagship'): PickingOrder {
  const order = structuredClone(createQP02GroupedOrder(locationId));
  const deal = order.groups![0];
  const modifier = 'grp_modifier';
  const custom = 'grp_custom';
  const upsell = 'grp_upsell';
  const addon = 'grp_addon';

  deal.lineIds = [...deal.itemIds];
  deal.verificationPolicy = 'INHERIT';
  deal.childGroupIds = [modifier, custom, upsell, addon];

  const sandwich = order.items.find((line) => line._id === 'item_bundle_sandwich_01')!;
  sandwich.lineType = 'PRODUCT';
  sandwich.groupIds = [deal.id];

  const note = order.items.find((line) => line._id === 'item_bundle_no_mayo_note')!;
  note.lineType = 'INSTRUCTION';
  note.groupId = custom;
  note.groupIds = [deal.id, custom];
  note.parentLineId = sandwich._id;

  const crisps = order.items.find((line) => line._id === 'item_bundle_crisps_02')!;
  crisps.lineType = 'PRODUCT';
  crisps.groupId = addon;
  crisps.groupIds = [deal.id, addon];

  const drink = order.items.find((line) => line._id === 'item_bundle_drink_03')!;
  drink.lineType = 'PRODUCT';
  drink.groupId = upsell;
  drink.groupIds = [deal.id, upsell];

  const weighed = order.items.find((line) => line._id === 'item_bundle_apple_weighed_04')!;
  weighed.lineType = 'PRODUCT';
  weighed.groupIds = [deal.id];

  const restricted = order.items.find((line) => line._id === 'item_bundle_beer_restricted_05')!;
  restricted.lineType = 'PRODUCT';
  restricted.groupIds = [deal.id];

  const standalone = order.items.find((line) => line._id === 'item_standalone_cookies_06')!;
  standalone.lineType = 'PRODUCT';
  standalone.componentRole = 'STANDALONE';

  const modifierLine = {
    _id: 'item_modifier_demo',
    plu: '502111',
    name: 'Extra cheese',
    quantity: 1,
    price: 75,
    status: 'PENDING' as const,
    lineType: 'PRODUCT' as const,
    componentRole: 'MODIFIER' as const,
    groupId: modifier,
    groupIds: [deal.id, modifier],
    parentLineId: sandwich._id,
    channelItemId: 'ch_modifier_demo',
  };

  const customerSubLine = {
    _id: 'item_customer_sub_demo',
    plu: '501700',
    name: 'Yoghurt pot',
    quantity: 1,
    price: 125,
    status: 'PENDING' as const,
    lineType: 'PRODUCT' as const,
    componentRole: 'COMPONENT' as const,
    groupId: deal.id,
    groupIds: [deal.id],
    channelItemId: 'ch_customer_sub_demo',
    customerSelectedSubstitution: {
      source: 'CUSTOMER' as const,
      itemId: 'catalogue_alt_demo',
      plu: '501701',
      name: 'Customer chosen alternative',
      quantity: 1,
      price: 125,
    },
  };

  order.items.push(modifierLine, customerSubLine);
  deal.itemIds.push(modifierLine._id, customerSubLine._id);
  deal.lineIds!.push(modifierLine._id, customerSubLine._id);

  order.groups!.push(
    { id: modifier, name: 'Selected modifiers', type: 'MODIFIER_GROUP', itemIds: [modifierLine._id], lineIds: [modifierLine._id], parentGroupId: deal.id, parentItemId: sandwich._id, pickAllPolicy: 'SAFE_CHILDREN_ONLY', verificationPolicy: 'INHERIT' },
    { id: custom, name: 'Instructions', type: 'CUSTOMISATION_GROUP', itemIds: [note._id], lineIds: [note._id], parentGroupId: deal.id, parentItemId: sandwich._id, pickAllPolicy: 'DISABLED', verificationPolicy: 'INDIVIDUAL_LINES' },
    { id: upsell, name: 'Drink upgrade', type: 'UPSELL_GROUP', itemIds: [drink._id], lineIds: [drink._id], parentGroupId: deal.id, pickAllPolicy: 'SAFE_CHILDREN_ONLY', verificationPolicy: 'INHERIT' },
    { id: addon, name: 'Side add-on', type: 'ADD_ON_GROUP', itemIds: [crisps._id], lineIds: [crisps._id], parentGroupId: deal.id, pickAllPolicy: 'SAFE_CHILDREN_ONLY', verificationPolicy: 'INHERIT' },
  );

  return order;
}
