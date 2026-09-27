import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../apps/server/src/app.js';
import { MockDeliverectServer } from '../packages/mock-deliverect/src/index.js';
import { globalStore } from '../apps/server/src/store.js';

describe('Webhook Deduplication by SHA-256', () => {
  let app: any;
  let mockServer: MockDeliverectServer;

  beforeEach(() => {
    mockServer = new MockDeliverectServer();
    const serverInstance = createApp({ mockDeliverect: mockServer });
    app = serverInstance.app;
  });

  it('accepts first webhook and ignores duplicate identical raw body', async () => {
    const payload = {
      _id: 'ord_dedupe_test_' + Date.now(),
      location: 'loc_london_flagship',
      channelOrderId: 'DUP-999',
      items: [{ _id: 'i1', plu: '501234', name: 'Craft Lager', quantity: 2, price: 650 }],
    };

    const rawBody = JSON.stringify(payload);
    const secret = globalStore.getHmacSecret('loc_london_flagship');
    const signature = mockServer.signPayload(rawBody, secret);

    // 1st delivery -> received
    const res1 = await request(app)
      .post('/picking/order')
      .set('Content-Type', 'application/json')
      .set('x-deliverect-hmac-sha256', signature)
      .send(rawBody);

    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe('received');

    // 2nd delivery with exact same raw body -> ignored duplicate
    const res2 = await request(app)
      .post('/picking/order')
      .set('Content-Type', 'application/json')
      .set('x-deliverect-hmac-sha256', signature)
      .send(rawBody);

    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('ignored_duplicate');
    expect(res2.body.message).toContain('already processed');
  });
  it('does not let an invalid HMAC delivery poison replay dedupe', async () => {
    const payload = {
      _id: 'ord_dedupe_hmac_' + Date.now(),
      location: 'loc_london_flagship',
      channelOrderId: 'DUP-HMAC-001',
      items: [{ _id: 'i1', plu: '501235', name: 'Sparkling Water', quantity: 1, price: 120 }],
    };

    const rawBody = JSON.stringify(payload);
    const secret = globalStore.getHmacSecret('loc_london_flagship');
    const validSignature = mockServer.signPayload(rawBody, secret);
    const invalidSignature = 'deadbeef'.repeat(8);

    const invalid = await request(app)
      .post('/picking/order')
      .set('Content-Type', 'application/json')
      .set('x-deliverect-hmac-sha256', invalidSignature)
      .send(rawBody);

    expect(invalid.status).toBe(401);

    const valid = await request(app)
      .post('/picking/order')
      .set('Content-Type', 'application/json')
      .set('x-deliverect-hmac-sha256', validSignature)
      .send(rawBody);

    expect(valid.status).toBe(200);
    expect(valid.body.status).toBe('received');

    const replay = await request(app)
      .post('/picking/order')
      .set('Content-Type', 'application/json')
      .set('x-deliverect-hmac-sha256', validSignature)
      .send(rawBody);

    expect(replay.status).toBe(200);
    expect(replay.body.status).toBe('ignored_duplicate');
  });

});
