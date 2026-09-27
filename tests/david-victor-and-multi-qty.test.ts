import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../apps/server/src/app.js';
import { globalStore } from '../apps/server/src/store.js';

describe('David Victor Ordering Integration & Multi-Quantity Picking', () => {
  let app: any;

  beforeEach(() => {
    const serverInstance = createApp();
    app = serverInstance.app;
  });

  it('ingests order from David Victor store and sequences with Altie AI', async () => {
    const payload = {
      channelOrderId: 'DV-102938',
      channelOrderDisplayId: '#DV-4821',
      customer: {
        name: 'David Leitch',
        phone: '+44 7700 900888',
        email: 'david@david-victor.com',
      },
      note: 'Placed from djl88/david-victor ordering engine. Please pack chilled drinks together.',
      items: [
        {
          plu: '502345',
          name: 'Artisan San Francisco Sourdough',
          quantity: 2,
          price: 380,
          temperature: 'AMBIENT',
          aisle: 'Aisle 2',
        },
        {
          plu: '735112',
          name: 'Reserve Nitro Cold Brew',
          quantity: 3,
          price: 320,
          temperature: 'CHILLED',
          aisle: 'Aisle 5',
        },
      ],
    };

    const res = await request(app)
      .post('/api/david-victor/order')
      .send(payload)
      .expect(200);

    expect(res.body.status).toBe('success');
    expect(res.body.orderId).toBeDefined();
    expect(res.body.order.channelOrderDisplayId).toBe('#DV-4821');
    expect(res.body.order.customer.name).toBe('David Leitch');
    expect(res.body.order.items.length).toBe(2);

    // Verify stored in order queue
    const saved = globalStore.getOrder(res.body.orderId);
    expect(saved).toBeDefined();
    expect(saved?.items[0].quantity).toBe(2);
    expect(saved?.items[1].quantity).toBe(3);

    // Check audit trail recorded source
    const logs = globalStore.getAuditLogs(res.body.orderId);
    expect(logs.some((l) => l.actor.includes('David Victor') || l.action.includes('david-victor'))).toBe(true);
  });

  it('supports tolerant endpoint /picking/order/david-victor', async () => {
    const res = await request(app)
      .post('/picking/order/david-victor')
      .send({
        customer: { name: 'David Victor Customer' },
        items: [{ plu: '4011', name: 'Organic Bananas', quantity: 3, price: 150 }],
      })
      .expect(200);

    expect(res.body.status).toBe('success');
    expect(res.body.order.items[0].quantity).toBe(3);
    expect(res.body.order.items[0].pickedQuantity).toBe(0);
  });
});
