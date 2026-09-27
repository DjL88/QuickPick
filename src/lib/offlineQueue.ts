/**
 * @file src/lib/offlineQueue.ts
 * IndexedDB backed offline mutation queue.
 * Ensures pick operations and item mutations are preserved offline and automatically synced.
 */

import { openDB, IDBPDatabase } from 'idb';
import { UpdateOrderItemAction } from '@contracts/index.js';

export interface QueuedBatchMutation {
  id: string;
  orderId: string;
  timestamp: string;
  updates: UpdateOrderItemAction[];
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  lastError?: string;
}

const DB_NAME = 'ltx_picker_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'mutations_queue';

class OfflineQueueManager {
  private dbPromise: Promise<IDBPDatabase> | null = null;

  private async getDB(): Promise<IDBPDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('orderId', 'orderId', { unique: false });
            store.createIndex('status', 'status', { unique: false });
          }
        },
      });
    }
    return this.dbPromise;
  }

  /**
   * Enqueue updates in IndexedDB
   */
  public async enqueue(orderId: string, updates: UpdateOrderItemAction[]): Promise<QueuedBatchMutation> {
    const db = await this.getDB();
    const entry: QueuedBatchMutation = {
      id: 'queue_' + Math.random().toString(36).substring(2, 9),
      orderId,
      timestamp: new Date().toISOString(),
      updates,
      status: 'PENDING',
      retryCount: 0,
    };

    await db.put(STORE_NAME, entry);
    return entry;
  }

  /**
   * Get all pending items
   */
  public async getPending(): Promise<QueuedBatchMutation[]> {
    const db = await this.getDB();
    const all: QueuedBatchMutation[] = await db.getAll(STORE_NAME);
    return all.filter((item) => item.status === 'PENDING' || item.status === 'FAILED');
  }

  /**
   * Remove or mark synced
   */
  public async markSynced(id: string) {
    const db = await this.getDB();
    await db.delete(STORE_NAME, id);
  }

  public async markFailed(id: string, error: string) {
    const db = await this.getDB();
    const item = (await db.get(STORE_NAME, id)) as QueuedBatchMutation | undefined;
    if (item) {
      item.status = 'FAILED';
      item.retryCount += 1;
      item.lastError = error;
      await db.put(STORE_NAME, item);
    }
  }

  /**
   * Flush queue to server
   */
  public async flush(
    onSyncSuccess?: (entry: QueuedBatchMutation) => void,
    onSyncError?: (entry: QueuedBatchMutation, err: any) => void
  ): Promise<number> {
    const pending = await this.getPending();
    if (pending.length === 0) return 0;

    let syncedCount = 0;
    for (const item of pending) {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(item.orderId)}/batch-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: item.updates }),
        });

        if (res.ok) {
          await this.markSynced(item.id);
          syncedCount++;
          onSyncSuccess?.(item);
        } else {
          const err = await res.text();
          await this.markFailed(item.id, `Server returned ${res.status}: ${err}`);
          onSyncError?.(item, err);
        }
      } catch (err: any) {
        await this.markFailed(item.id, err.message || 'Network unreachable');
        onSyncError?.(item, err);
      }
    }

    return syncedCount;
  }
}

export const offlineQueue = new OfflineQueueManager();
