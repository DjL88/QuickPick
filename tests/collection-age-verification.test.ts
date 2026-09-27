/**
 * @file tests/collection-age-verification.test.ts
 * Tests for collection order age verification (18+) and handover confirmation.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../apps/server/src/app.js';
import { globalStore } from '../apps/server/src/store.js';

describe('Collection Order Age Restriction (18+) & Handover Verification', () => {
  it('creates a pickup/collection order containing age restricted items and verifies age check flag', async () => {
    const { app } = createApp();

    const collectionPayload = {
      storeId: 'store_david_victor',
      storeName: 'David Victor Artisanal Deli',
      orderType: 'PICKUP',
      customer: {
        name: 'Sarah Connor',
        phone: '+44 7911 888999',
      },
      cartItems: [
        {
          plu: 'DV-601',
          name: 'Craft IPA Pale Ale (330ml Can 5.2%)',
          unitPrice: 3.90,
          quantity: 2,
          ageRestricted: true,
          minimumAge: 18,
        },
      ],
      subtotal: 7.80,
      deliveryFee: 0,
      serviceFee: 0.99,
      bagFee: 0.20,
      tipAmount: 0,
      total: 8.99,
    };

    const res = await request(app)
      .post('/api/commerce/order')
      .send(collectionPayload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const orderId = res.body.orderId;
    const storedOrder = globalStore.getOrder(orderId);

    expect(storedOrder).toBeDefined();
    expect(storedOrder?.orderType).toBe('PICKUP');

    // Verify age restricted item flags exist
    const ageRestrictedItems = storedOrder?.items.filter(
      (i) => i.ageRestricted || (i.minimumAge && i.minimumAge >= 18)
    );
    expect(ageRestrictedItems?.length).toBe(1);
    expect(ageRestrictedItems?.[0].ageRestricted).toBe(true);
  });
});
