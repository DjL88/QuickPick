import { normalisePickingStructure } from '../../contracts/src/index.js';

export const groupedDemo = normalisePickingStructure([
  {
    _id: 'demo-bundle',
    itemType: 'BUNDLE',
    isContainer: true,
    name: 'Demo bundle',
    subItems: [
      { _id: 'demo-main', plu: 'MAIN-1', name: 'Main item', quantity: 1, price: 500 },
      { _id: 'demo-side', plu: 'SIDE-1', name: 'Side item', quantity: 1, price: 200, requiresScan: true },
    ],
  },
], { orderId: 'demo-order' });
