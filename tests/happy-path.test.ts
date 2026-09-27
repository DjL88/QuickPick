import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../apps/server/src/app.js';
import { MockDeliverectServer } from '../packages/mock-deliverect/src/index.js';
import { globalStore } from '../apps/server/src/store.js';

describe('Full Happy Path (Start -> Pick -> Replace -> Adjust -> Couriers -> Done)', () => {
  let app: any;
  let mockServer: MockDeliverectServer;
  let outboxWorker: any;

  beforeEach(() => {
    mockServer = new MockDeliverectServer();
    const serverInstance = createApp({ mockDeliverect: mockServer });
    app = serverInstance.app;
    outboxWorker = serverInstance.outboxWorker;
  });

  it('executes complete picking journey against Deliverect mock simulator', async () => {
    // 1. Inbound Webhook: Deliverect posts new retail order
    const orderPayload = {
      _id: 'ord_happy_path_' + Date.now(),
      location: 'loc_london_flagship',
      channelOrderId: 'UBER-HP-1',
      channelOrderDisplayId: '#UB-900',
      items: [
        { _id: 'item_1', plu: '4011', name: 'Bananas', quantity: 2, price: 150, temperature: 'AMBIENT' },
        { _id: 'item_2', plu: '735005', name: 'Oat Milk 1L', quantity: 1, price: 210, temperature: 'CHILLED' },
      ],
      customer: { name: 'Arthur Dent', phone: '+44 7111 222333' },
      pickupTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    const rawBody = JSON.stringify(orderPayload);
    const secret = globalStore.getHmacSecret('loc_london_flagship');
    const signature = mockServer.signPayload(rawBody, secret);

    const webhookRes = await request(app)
      .post('/picking/order')
      .set('Content-Type', 'application/json')
      .set('x-deliverect-hmac-sha256', signature)
      .send(rawBody);

    expect(webhookRes.status).toBe(200);

    // Give async order parsing a moment
    await new Promise((r) => setTimeout(r, 50));

    const orderId = orderPayload._id;

    // 2. Picker Starts Order
    const startRes = await request(app)
      .post(`/api/orders/${orderId}/start`)
      .send({ pickerId: 'staff_1', pickerName: 'Staff Arthur' });

    expect(startRes.status).toBe(200);
    expect(startRes.body.pickerStatus).toBe('IN_PROGRESS');

    // 3. Picker Picks First Item
    const pickRes = await request(app)
      .post(`/api/orders/${orderId}/items/item_1/pick`)
      .send({ pickedWeight: 1.22, pickerName: 'Staff Arthur' });

    expect(pickRes.status).toBe(200);
    expect(pickRes.body.item.status).toBe('PICKED');

    // 4. Picker Replaces Second Item (Oat Milk out of stock -> replace with Almond Milk)
    const replaceRes = await request(app)
      .post(`/api/orders/${orderId}/batch-update`)
      .send({
        pickerName: 'Staff Arthur',
        updates: [
          {
            itemId: 'item_2',
            action: 'REPLACE',
            reason: 'OUT_OF_STOCK',
            properties: {
              replaceItem: {
                plu: '735999',
                name: 'Almond Milk Barista 1L',
                quantity: 1,
                price: 230,
              },
            },
          },
        ],
      });

    expect(replaceRes.status).toBe(200);
    expect(replaceRes.body.updatesApplied).toBe(1);

    // 5. Picker Adjusts Quantity
    const adjustRes = await request(app)
      .post(`/api/orders/${orderId}/batch-update`)
      .send({
        pickerName: 'Staff Arthur',
        updates: [
          {
            itemId: 'item_1',
            action: 'ADJUST',
            properties: { quantity: 1 },
          },
        ],
      });

    expect(adjustRes.status).toBe(200);

    // 6. Courier Count Check
    const courierRes = await request(app)
      .post(`/api/orders/${orderId}/couriers`)
      .send({ count: 2, reason: 'Large bulky bags' });

    expect(courierRes.status).toBe(200);
    expect(courierRes.body.courierCount).toBe(2);

    // 7. Finish Order Picking
    const finishRes = await request(app)
      .post(`/api/orders/${orderId}/finish`)
      .send({ courierCount: 2, pickerName: 'Staff Arthur' });

    expect(finishRes.status).toBe(200);
    expect(finishRes.body.pickerStatus).toBe('COMPLETED');

    // Allow Outbox worker to dispatch queued records to Mock Deliverect
    await outboxWorker.processQueue();

    // 8. Assertions on Mock Deliverect recorded calls
    const recordedEndpoints = mockServer.recordedCalls.map((c) => c.url);
    expect(recordedEndpoints.some((url) => url.includes('/oauth/token'))).toBe(true);
    expect(recordedEndpoints.some((url) => url.includes('/start'))).toBe(true);
    expect(recordedEndpoints.some((url) => url.includes('/pick'))).toBe(true);
    expect(recordedEndpoints.some((url) => url.includes('/updateOrderItems'))).toBe(true);
    expect(recordedEndpoints.some((url) => url.includes('/couriers'))).toBe(true);
    expect(recordedEndpoints.some((url) => url.includes('/done'))).toBe(true);
  });
});
