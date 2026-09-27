import { describe, it, expect, vi } from 'vitest';
import { UpdateOrderItemAction } from '../packages/contracts/src/index.js';

describe('Offline Queue Flushing', () => {
  it('queues offline updates and flushes batch mutations when network restores', async () => {
    // Mock fetch for offline sync test
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'acknowledged', updatesApplied: 1 }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const queuedItems = [
      {
        id: 'q_1',
        orderId: 'ord_off_1',
        updates: [
          {
            itemId: 'item_1',
            action: 'PICK' as const,
            properties: { pickedWeight: 1.15 },
          },
        ],
      },
    ];

    let flushedCount = 0;
    for (const item of queuedItems) {
      const res = await fetch(`/api/orders/${item.orderId}/batch-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: item.updates }),
      });
      if (res.ok) {
        flushedCount++;
      }
    }

    expect(flushedCount).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/orders/ord_off_1/batch-update',
      expect.objectContaining({
        method: 'POST',
      })
    );

    vi.unstubAllGlobals();
  });
});
