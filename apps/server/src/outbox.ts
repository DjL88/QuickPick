/**
 * @file apps/server/src/outbox.ts
 * Reliable Outbox Worker ensuring non-idempotent Deliverect mutations are never duplicated.
 * - Idempotency key = orderId + itemId + action + hash
 * - NEVER resends after a 2xx response
 * - Retries 5xx/429 with exponential backoff and jitter
 * - Broadcasts failures and sync state to the picker app
 */

import crypto from 'crypto';
import { OutboxRecord, OutboxStatus } from '../../../packages/contracts/src/index.js';
import { DeliverectClient } from './deliverectClient.js';
import { globalStore } from './store.js';

export interface OutboxOptions {
  maxAttempts?: number;
  baseBackoffMs?: number;
}

export class OutboxWorker {
  private deliverectClient: DeliverectClient;
  private maxAttempts: number;
  private baseBackoffMs: number;
  private processingPromise: Promise<void> | null = null;
  private intervalId?: NodeJS.Timeout;

  constructor(deliverectClient: DeliverectClient, options: OutboxOptions = {}) {
    this.deliverectClient = deliverectClient;
    this.maxAttempts = options.maxAttempts || 5;
    this.baseBackoffMs = options.baseBackoffMs || 1000;
  }

  /**
   * Generates a stable idempotency key for an action
   */
  public generateIdempotencyKey(orderId: string, itemId: string | undefined, action: string, payload: any): string {
    const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    const hash = crypto.createHash('sha256').update(rawPayload).digest('hex').substring(0, 16);
    return `${orderId}:${itemId || 'order'}:${action}:${hash}`;
  }

  /**
   * Enqueues an action or returns the existing record if already executed/enqueued.
   */
  public async enqueue(
    orderId: string,
    itemId: string | undefined,
    action: string,
    endpoint: string,
    method: 'POST' | 'GET' | 'PUT',
    payload: any
  ): Promise<OutboxRecord> {
    const idempotencyKey = this.generateIdempotencyKey(orderId, itemId, action, payload);

    // Check if an entry with this idempotency key already exists
    const existing = globalStore.outboxRecords.get(idempotencyKey);
    if (existing) {
      if (existing.status === 'SENT') {
        // Strictly NEVER resend after a 2xx!
        return existing;
      }
      if (existing.status === 'SENDING' || existing.status === 'QUEUED') {
        return existing;
      }
      // If it failed and we want to re-trigger, reset status to QUEUED
      if (existing.status === 'FAILED') {
        existing.status = 'QUEUED';
        existing.nextRetryAt = new Date().toISOString();
        globalStore.outboxRecords.set(idempotencyKey, existing);
        this.triggerProcess();
        return existing;
      }
    }

    const record: OutboxRecord = {
      id: 'outbox_' + Math.random().toString(36).substring(2, 9),
      idempotencyKey,
      orderId,
      endpoint,
      method,
      payload,
      status: 'QUEUED',
      attempts: 0,
      maxAttempts: this.maxAttempts,
      createdAt: new Date().toISOString(),
      nextRetryAt: new Date().toISOString(),
    };

    globalStore.outboxRecords.set(idempotencyKey, record);
    globalStore.emit('outbox:record', record);

    // Trigger immediate execution
    this.triggerProcess();

    return record;
  }

  public triggerProcess() {
    setImmediate(() => this.processQueue());
  }

  public startBackgroundWorker(intervalMs = 3000) {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => this.processQueue(), intervalMs);
  }

  public stopBackgroundWorker() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Processes ready records in the outbox
   */
  public async processQueue(): Promise<void> {
    if (this.processingPromise) {
      await this.processingPromise;
      const hasMore = Array.from(globalStore.outboxRecords.values()).some(
        (r) => r.status === 'QUEUED' && (!r.nextRetryAt || new Date(r.nextRetryAt).getTime() <= Date.now())
      );
      if (!hasMore) return;
    }

    this.processingPromise = this.runQueue();
    try {
      await this.processingPromise;
    } finally {
      this.processingPromise = null;
    }
  }

  private async runQueue() {
    while (true) {
      const now = Date.now();
      const records = Array.from(globalStore.outboxRecords.values()).filter((r) => {
        if (r.status !== 'QUEUED') return false;
        if (!r.nextRetryAt) return true;
        return new Date(r.nextRetryAt).getTime() <= now;
      });

      if (records.length === 0) break;

      for (const record of records) {
        await this.dispatchRecord(record);
      }
    }
  }

  /**
   * Dispatches a single record to Deliverect with retry and 2xx freeze semantics.
   */
  public async dispatchRecord(record: OutboxRecord): Promise<OutboxRecord> {
    // Re-check: if already sent (received 2xx), never dispatch again!
    if (record.status === 'SENT') {
      return record;
    }

    record.status = 'SENDING';
    record.attempts += 1;
    record.lastAttemptAt = new Date().toISOString();
    globalStore.outboxRecords.set(record.idempotencyKey, record);
    globalStore.emit('outbox:record', record);

    try {
      const response = await this.deliverectClient.request(record.endpoint, {
        method: record.method,
        body: record.payload,
      });

      record.responseStatus = response.status;
      record.responseBody = response.data;

      if (response.status >= 200 && response.status < 300) {
        // SUCCESS: Mark as SENT. Will NEVER be resent.
        record.status = 'SENT';
        record.error = undefined;
        globalStore.addAuditLog(record.orderId, 'OUTBOX', `Successfully sent to Deliverect (${record.endpoint})`, {
          idempotencyKey: record.idempotencyKey,
          status: response.status,
        });
      } else if (response.status === 429 || response.status >= 500) {
        // RETRYABLE ERROR: 429 Rate Limit or 5xx Server Error
        if (record.attempts >= record.maxAttempts) {
          record.status = 'FAILED';
          record.error = `Exceeded max retry attempts (${record.maxAttempts}). Status: ${response.status}`;
          globalStore.addAuditLog(record.orderId, 'OUTBOX', `Permanent failure after ${record.attempts} attempts: ${record.error}`);
        } else {
          record.status = 'QUEUED';
          // Exponential backoff with jitter
          const delay = Math.min(30000, this.baseBackoffMs * Math.pow(2, record.attempts) + Math.random() * 500);
          record.nextRetryAt = new Date(Date.now() + delay).toISOString();
          record.error = `Temporary failure (${response.status}). Retrying in ${Math.round(delay / 1000)}s...`;
        }
      } else {
        // NON-RETRYABLE CLIENT ERROR: 400, 404, 412, etc.
        record.status = 'TERMINAL_ERROR';
        record.error = `Terminal client error (${response.status}): ${JSON.stringify(response.data)}`;
        globalStore.addAuditLog(record.orderId, 'OUTBOX', `Terminal error: ${record.error}`);
      }
    } catch (err: any) {
      // Network exception (e.g. timeout / connection refused)
      if (record.attempts >= record.maxAttempts) {
        record.status = 'FAILED';
        record.error = `Network error after ${record.attempts} attempts: ${err.message}`;
      } else {
        record.status = 'QUEUED';
        const delay = Math.min(30000, this.baseBackoffMs * Math.pow(2, record.attempts) + 200);
        record.nextRetryAt = new Date(Date.now() + delay).toISOString();
        record.error = `Network exception: ${err.message}. Retrying...`;
      }
    }

    globalStore.outboxRecords.set(record.idempotencyKey, record);
    globalStore.emit('outbox:record', record);
    return record;
  }

  public getAllRecords(): OutboxRecord[] {
    return Array.from(globalStore.outboxRecords.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}
