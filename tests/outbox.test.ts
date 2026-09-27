import { describe, it, expect, beforeEach } from 'vitest';
import { OutboxWorker } from '../apps/server/src/outbox.js';
import { DeliverectClient } from '../apps/server/src/deliverectClient.js';
import { globalStore } from '../apps/server/src/store.js';

describe('Outbox Non-Idempotent Protection & Retries', () => {
  let fakeClient: any;
  let worker: OutboxWorker;
  let callCount: number;

  beforeEach(() => {
    globalStore.outboxRecords.clear();
    callCount = 0;

    fakeClient = {
      request: async (endpoint: string, options: any) => {
        callCount++;
        return { status: 200, data: { success: true } };
      },
    };

    worker = new OutboxWorker(fakeClient, { maxAttempts: 3, baseBackoffMs: 10 });
  });

  it('generates consistent idempotency keys for identical actions', () => {
    const key1 = worker.generateIdempotencyKey('ord_1', 'item_1', 'PICK', { weight: 1.2 });
    const key2 = worker.generateIdempotencyKey('ord_1', 'item_1', 'PICK', { weight: 1.2 });
    const key3 = worker.generateIdempotencyKey('ord_1', 'item_1', 'PICK', { weight: 1.5 });

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it('never double-sends an action after a 2xx response', async () => {
    const orderId = 'ord_idemp_1';
    const itemId = 'item_1';
    const action = 'PICK';
    const payload = { timestamp: '2026-09-26T23:00:00Z' };

    // 1st enqueue -> triggers dispatch, gets 200
    const rec1 = await worker.enqueue(orderId, itemId, action, '/picking/order/ord_1/item/1/pick', 'POST', payload);
    await worker.dispatchRecord(rec1);

    expect(rec1.status).toBe('SENT');
    expect(callCount).toBe(1);

    // 2nd enqueue with same payload -> must return existing record and NOT call client again
    const rec2 = await worker.enqueue(orderId, itemId, action, '/picking/order/ord_1/item/1/pick', 'POST', payload);
    await worker.dispatchRecord(rec2);

    expect(rec2.status).toBe('SENT');
    expect(callCount).toBe(1); // Call count remains 1! No double-send after 2xx
  });

  it('retries 5xx server errors with backoff up to maxAttempts', async () => {
    let failCount = 0;
    const failingClient: any = {
      request: async () => {
        failCount++;
        return { status: 500, data: { error: 'Internal error' } };
      },
    };

    const retryWorker = new OutboxWorker(failingClient, { maxAttempts: 3, baseBackoffMs: 5 });
    const record = await retryWorker.enqueue('ord_fail_1', undefined, 'START', '/picking/order/ord_fail_1/start', 'POST', {});

    // Attempt 1 -> fails with 500, queued for retry
    await retryWorker.dispatchRecord(record);
    expect(record.status).toBe('QUEUED');
    expect(record.attempts).toBe(1);

    // Attempt 2
    await retryWorker.dispatchRecord(record);
    expect(record.status).toBe('QUEUED');
    expect(record.attempts).toBe(2);

    // Attempt 3 -> reaches maxAttempts, marked FAILED
    await retryWorker.dispatchRecord(record);
    expect(record.status).toBe('FAILED');
    expect(record.attempts).toBe(3);
    expect(failCount).toBe(3);
  });
});
