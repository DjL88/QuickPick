/**
 * @file packages/mock-deliverect/src/qp02-fixture.ts
 * QP-02 realistic bundle/group demo fixture for Deliverect Generic Picking.
 * Demonstrates bundles, parent/child relationships, component roles,
 * text-only instructions, and Safe Pick All validation.
 */

import { PickingOrder, ItemUnavailableAction } from '../../contracts/src/index.js';

export function createQP02GroupedOrder(locationId: string = 'loc_london_flagship'): PickingOrder {
  const now = Date.now();

  return {
    _id: 'deliv_ord_qp02_bundle_demo',
    location: locationId,
    channelOrderId: 'DELIVEROO-MD-8821',
    channelOrderDisplayId: '#DLV-8821',
    pickupTime: new Date(now + 20 * 60 * 1000).toISOString(),
    deliveryTime: new Date(now + 35 * 60 * 1000).toISOString(),
    orderType: 'DELIVERY',
    customer: {
      name: 'Clara Oswald',
      phone: '+44 7700 900555',
      email: 'clara.oswald@example.co.uk',
    },
    note: 'Meal deal customisations specified. Please pack cold drinks separately from bakery.',
    status: 'SCHEDULED',
    pickerStatus: 'NOT_STARTED',
    receivedAt: new Date(now - 5 * 60 * 1000).toISOString(),
    dueAt: new Date(now + 20 * 60 * 1000).toISOString(),
    groups: [
      {
        id: 'grp_artisan_lunch_deal',
        name: 'Artisan Lunch Meal Deal',
        type: 'MEAL_DEAL',
        pickAllPolicy: 'SAFE_CHILDREN_ONLY',
        itemIds: [
          'item_bundle_sandwich_01',
          'item_bundle_crisps_02',
          'item_bundle_drink_03',
          'item_bundle_no_mayo_note',
          'item_bundle_apple_weighed_04',
          'item_bundle_beer_restricted_05',
        ],
        totalCount: 6,
        pickedCount: 0,
      },
    ],
    items: [
      // 1. Primary main component (Safe for Pick All)
      {
        _id: 'item_bundle_sandwich_01',
        groupId: 'grp_artisan_lunch_deal',
        componentRole: 'COMPONENT',
        plu: '502110',
        name: 'Smoked Ham & Cheddar Sourdough Baguette',
        quantity: 1,
        price: 495,
        channelItemId: 'ch_sandwich_01',
        gtin: ['5060123451101'],
        department: 'Artisan Bakery',
        aisle: 'Aisle 2',
        shelf: 'Bay 1 - Grab & Go',
        sequence: 1,
        temperature: 'AMBIENT',
        isWeight: false,
        itemUnavailableActions: ['ITEM_SUBSTITUTION', 'ITEM_REMOVE'] as ItemUnavailableAction[],
        status: 'PENDING',
        imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&auto=format&fit=crop&q=80',
      },

      // 2. Text-only customisation instruction (NOT pickable, no fake PLU, excluded from Pick All)
      {
        _id: 'item_bundle_no_mayo_note',
        groupId: 'grp_artisan_lunch_deal',
        componentRole: 'CUSTOMISATION',
        isTextInstruction: true,
        plu: '', // No fake PLU!
        name: 'No Mayonnaise / Extra Butter',
        quantity: 1,
        price: 0,
        channelItemId: 'ch_no_mayo',
        department: 'Kitchen Instructions',
        sequence: 1.5,
        temperature: 'AMBIENT',
        status: 'PENDING',
      },

      // 3. Physical add-on snack component (Safe for Pick All)
      {
        _id: 'item_bundle_crisps_02',
        groupId: 'grp_artisan_lunch_deal',
        componentRole: 'ADD_ON',
        plu: '500022',
        name: 'Tyrrells Sea Salt & Cider Vinegar Hand Cooked Crisps 40g',
        quantity: 1,
        price: 130,
        channelItemId: 'ch_crisps_02',
        gtin: ['5000228012345'],
        department: 'Snacks',
        aisle: 'Aisle 3',
        shelf: 'Bay 2 - Mid Shelf',
        sequence: 2,
        temperature: 'AMBIENT',
        itemUnavailableActions: ['ITEM_AMENDMENT', 'ITEM_SUBSTITUTION', 'ITEM_REMOVE'] as ItemUnavailableAction[],
        status: 'PENDING',
        imageUrl: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=800&auto=format&fit=crop&q=80',
      },

      // 4. Physical drink component (Safe for Pick All)
      {
        _id: 'item_bundle_drink_03',
        groupId: 'grp_artisan_lunch_deal',
        componentRole: 'UPSELL',
        plu: '735901',
        name: 'Innocent Super Smoothie Energise 300ml',
        quantity: 1,
        price: 240,
        channelItemId: 'ch_smoothie_03',
        gtin: ['7359012850099'],
        department: 'Chilled Drinks',
        aisle: 'Aisle 4',
        shelf: 'Bay 1 - Chiller',
        sequence: 3,
        temperature: 'CHILLED',
        itemUnavailableActions: ['ITEM_SUBSTITUTION', 'ITEM_REMOVE'] as ItemUnavailableAction[],
        status: 'PENDING',
        imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=800&auto=format&fit=crop&q=80',
      },

      // 5. Fresh fruit component requiring scale weighing (UNSAFE for Pick All -> Must weigh)
      {
        _id: 'item_bundle_apple_weighed_04',
        groupId: 'grp_artisan_lunch_deal',
        componentRole: 'COMPONENT',
        plu: '4131',
        name: 'Honeycrisp Crisp Apple (Loose)',
        quantity: 1,
        price: 85,
        channelItemId: 'ch_apple_04',
        department: 'Fresh Produce',
        aisle: 'Aisle 1',
        shelf: 'Bay 3 - Produce Table',
        sequence: 4,
        temperature: 'AMBIENT',
        isWeight: true,
        weightUnit: 'kg',
        expectedWeight: 0.22,
        minWeight: 0.15,
        maxWeight: 0.35,
        itemUnavailableActions: ['ITEM_SUBSTITUTION', 'ITEM_REMOVE'] as ItemUnavailableAction[],
        status: 'PENDING',
        imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&auto=format&fit=crop&q=80',
      },

      // 6. Age-restricted add-on craft beer (UNSAFE for Pick All -> Must verify 18+ ID)
      {
        _id: 'item_bundle_beer_restricted_05',
        groupId: 'grp_artisan_lunch_deal',
        componentRole: 'MODIFIER',
        plu: '501999',
        name: 'Beavertown Neck Oil Session IPA 330ml Can',
        quantity: 1,
        price: 260,
        channelItemId: 'ch_ipa_05',
        gtin: ['5019993847120'],
        department: 'Beer, Wine & Spirits',
        aisle: 'Aisle 3',
        shelf: 'Bay 4 - Top Shelf',
        sequence: 5,
        temperature: 'AMBIENT',
        ageRestricted: true,
        minimumAge: 18,
        itemUnavailableActions: ['ITEM_SUBSTITUTION', 'CANCEL_ORDER'] as ItemUnavailableAction[],
        status: 'PENDING',
        imageUrl: 'https://images.unsplash.com/photo-1608270546103-979929285746?w=800&auto=format&fit=crop&q=80',
      },

      // 7. Standalone multi-quantity grocery item outside the bundle
      {
        _id: 'item_standalone_cookies_06',
        plu: '504433',
        name: 'Gooey Triple Chocolate Bakery Cookies (Pack of 4)',
        quantity: 2,
        price: 250,
        channelItemId: 'ch_cookies_06',
        gtin: ['5044338877665'],
        department: 'Bakery Treats',
        aisle: 'Aisle 2',
        shelf: 'Bay 3',
        sequence: 6,
        temperature: 'AMBIENT',
        itemUnavailableActions: ['ITEM_AMENDMENT', 'ITEM_SUBSTITUTION', 'ITEM_REMOVE'] as ItemUnavailableAction[],
        status: 'PENDING',
        imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&auto=format&fit=crop&q=80',
      },
    ],
  };
}
