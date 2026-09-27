import { normalisePickingStructure } from '../../contracts/src/index.js';

/**
 * Internal demo fixture only. Field names such as components/upsells are
 * intentionally treated as tolerant input aliases, not asserted Deliverect
 * Generic Picking wire semantics.
 */
export const groupedDemo = normalisePickingStructure([
  {
    _id: 'demo-deal',
    itemType: 'DEAL',
    isContainer: true,
    name: 'Lunch meal deal',
    subItems: [
      {
        _id: 'demo-main',
        plu: 'MAIN-1',
        name: 'Chicken salad sandwich',
        quantity: 1,
        price: 500,
        modifiers: [
          { _id: 'demo-instruction', name: 'No mayonnaise' },
          {
            _id: 'demo-sauce',
            plu: 'SAUCE-1',
            name: 'Ketchup sachet',
            quantity: 1,
            price: 0,
          },
        ],
        customisations: [{ _id: 'demo-cut', name: 'Cut in half' }],
        upsells: [
          {
            _id: 'demo-fruit',
            plu: 'FRUIT-1',
            name: 'Fruit pot',
            quantity: 1,
            price: 150,
          },
        ],
        addOns: [
          {
            _id: 'demo-dip',
            plu: 'DIP-1',
            name: 'Garlic dip',
            quantity: 1,
            price: 75,
          },
        ],
      },
      {
        _id: 'demo-side',
        plu: 'SIDE-1',
        gtin: ['5012345678901'],
        name: 'Cola 330ml',
        quantity: 1,
        price: 200,
        requiresScan: true,
        substitutionPreference: 'CUSTOMER_SELECTED',
        customerCandidates: [
          {
            itemId: 'demo-side-alt',
            plu: 'SIDE-2',
            name: 'Cola Zero 330ml',
            quantity: 1,
            price: 200,
          },
        ],
      },
      {
        _id: 'demo-weight',
        plu: 'WEIGHT-1',
        name: 'Loose tomatoes',
        quantity: 4,
        price: 240,
        isWeight: true,
        weightUnit: 'g',
        expectedWeight: 500,
      },
      {
        _id: 'demo-age',
        plu: 'AGE-1',
        name: 'Age restricted demo line',
        quantity: 1,
        price: 800,
        ageRestricted: true,
        minimumAge: 18,
        requiresIndividualVerification: true,
      },
    ],
  },
], { orderId: 'demo-order' });
