/**
 * @file tests/commerce-api.test.ts
 * Tests for Deliverect Commerce API ordering flow (Deliveroo & Uber Eats style).
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../apps/server/src/app.js';
import { globalStore } from '../apps/server/src/store.js';

describe('Deliverect Commerce API Ordering Flow', () => {
  it('creates an order from Deliveroo/Uber Eats cart with bundle meal deals and modifiers', async () => {
    const { app } = createApp();

    const orderPayload = {
      storeId: 'store_david_victor',
      storeName: 'David Victor Artisanal Deli & Bakery',
      orderType: 'DELIVERY',
      deliveryAddress: '142 Oxford St, London W1D 1LU',
      courierNotes: 'Ring buzzer 4B',
      customer: {
        name: 'David Leitch',
        phone: '+44 7700 900888',
        email: 'david@example.com',
      },
      cartItems: [
        {
          plu: 'DV-DEAL-01',
          name: 'Artisan Lunch Meal Deal',
          unitPrice: 13.50,
          quantity: 1,
          imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af',
          bundleSelections: [
            {
              groupId: 'bundle_main',
              groupName: 'Choose Your Main Sandwich',
              role: 'COMPONENT',
              plu: 'DV-101',
              name: 'New York Style Pastrami on Rye',
              priceDelta: 0,
            },
            {
              groupId: 'bundle_side',
              groupName: 'Select Your Side',
              role: 'COMPONENT',
              plu: 'DV-201',
              name: 'Rosemary & Sea Salt Hand-Cooked Crisps',
              priceDelta: 0,
            },
            {
              groupId: 'bundle_drink',
              groupName: 'Pick Your Drink',
              role: 'COMPONENT',
              plu: 'DV-303',
              name: 'Craft IPA Pale Ale (330ml)',
              priceDelta: 1.50,
              ageRestricted: true,
              minimumAge: 18,
            },
          ],
          specialInstructions: 'No mayonnaise please',
        },
        {
          plu: 'DV-401',
          name: 'Artisan Country Sourdough Loaf',
          unitPrice: 4.80,
          quantity: 2,
          imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff',
          selectedOptions: [
            {
              groupId: 'mod_slice',
              groupName: 'Slicing',
              optionId: 'thick',
              optionName: 'Thick Sliced',
              price: 0,
            },
          ],
        },
      ],
      subtotal: 23.10,
      deliveryFee: 1.99,
      serviceFee: 1.15,
      bagFee: 0.20,
      tipAmount: 2.00,
      total: 28.44,
    };

    // 1. Submit order via Deliverect Commerce API
    const res = await request(app)
      .post('/api/commerce/order')
      .send(orderPayload);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.orderId).toBeDefined();
    expect(res.body.channelOrderDisplayId).toMatch(/^#ORD-\d+/);

    const orderId = res.body.orderId;

    // 2. Verify stored order structure in global store
    const stored = globalStore.getOrder(orderId);
    expect(stored).toBeDefined();
    expect(stored?.customer.name).toBe('David Leitch');
    expect(stored?.customer.address).toBe('142 Oxford St, London W1D 1LU');
    expect(stored?.items.length).toBeGreaterThanOrEqual(4); // Parent deal + 3 bundle items + note + sourdough

    // 3. Verify group creation (QP-02 / QP-04)
    expect(stored?.groups).toBeDefined();
    expect(stored?.groups?.length).toBe(1);
    expect(stored?.groups?.[0].type).toBe('MEAL_DEAL');
    expect(stored?.groups?.[0].pickAllPolicy).toBe('SAFE_CHILDREN_ONLY');

    // 4. Verify live tracking endpoint
    const trackRes = await request(app).get(`/api/commerce/orders/${encodeURIComponent(orderId)}/track`);
    expect(trackRes.status).toBe(200);
    expect(trackRes.body.orderId).toBe(orderId);
    expect(trackRes.body.stage).toBe('ORDER_PLACED');
    expect(trackRes.body.totalItems).toBe(stored?.items.length);
  });
});
