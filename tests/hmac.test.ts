import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../apps/server/src/app.js';
import { globalStore } from '../apps/server/src/store.js';
import { MockDeliverectServer } from '../packages/mock-deliverect/src/index.js';

describe('HMAC Verification (Deliverect Webhook Ingress)', () => {
  let app: any;
  let mockServer: MockDeliverectServer;

  beforeEach(() => {
    mockServer = new MockDeliverectServer();
    const serverInstance = createApp({ mockDeliverect: mockServer });
    app = serverInstance.app;
  });

  it('accepts valid HMAC signature with standard X-Deliverect-Hmac-Sha256 header', async () => {
    const payload = {
      _id: 'ord_test_valid_hmac_' + Date.now(),
      location: 'loc_london_flagship',
      channelOrderId: 'UBER-991',
      items: [
        { _id: 'i1', plu: '4011', name: 'Bananas', quantity: 1, price: 150 },
      ],
    };

    const rawBody = JSON.stringify(payload);
    const secret = globalStore.getHmacSecret('loc_london_flagship');
    const signature = mockServer.signPayload(rawBody, secret);

    const res = await request(app)
      .post('/picking/order')
      .set('Content-Type', 'application/json')
      .set('x-deliverect-hmac-sha256', signature)
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('received');
  });

  it('accepts alternate header x-server-authorization-hmac-sha256', async () => {
    const payload = {
      _id: 'ord_test_alt_header_' + Date.now(),
      location: 'loc_london_flagship',
      channelOrderId: 'DELIV-772',
      items: [],
    };

    const rawBody = JSON.stringify(payload);
    const secret = globalStore.getHmacSecret('loc_london_flagship');
    const signature = mockServer.signPayload(rawBody, secret);

    const res = await request(app)
      .post('/picking/order')
      .set('Content-Type', 'application/json')
      .set('x-server-authorization-hmac-sha256', signature)
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('received');
  });

  it('rejects tampered body or invalid HMAC with 401 Unauthorized', async () => {
    const payload = {
      _id: 'ord_test_tampered_' + Date.now(),
      location: 'loc_london_flagship',
      channelOrderId: 'TAMPERED-001',
      items: [],
    };

    const rawBody = JSON.stringify(payload);
    const fakeSignature = 'deadbeef1234567890abcdefdeadbeef1234567890abcdefdeadbeef12345678';

    const res = await request(app)
      .post('/picking/order')
      .set('Content-Type', 'application/json')
      .set('x-deliverect-hmac-sha256', fakeSignature)
      .send(rawBody);

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Unauthorized');
  });

  it('uses locationId as HMAC secret fallback when per-location secret not explicitly set', async () => {
    const customLocation = 'loc_store_custom_99';
    const payload = {
      _id: 'ord_custom_loc_' + Date.now(),
      location: customLocation,
      channelOrderId: 'CUSTOM-123',
      items: [],
    };

    const rawBody = JSON.stringify(payload);
    // Staging often = locationId
    const signature = mockServer.signPayload(rawBody, customLocation);

    const res = await request(app)
      .post('/picking/order')
      .set('Content-Type', 'application/json')
      .set('x-deliverect-hmac-sha256', signature)
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('received');
  });
});
