import { describe, expect, it } from 'vitest';
import { PickingOrder } from '../packages/contracts/src/index.js';
import { classifyHeadsUpOrder, getHeadsUpDueState, getHeadsUpProgress } from '../src/lib/headsup.js';
import { MockPrinterProvider } from '../src/lib/printers.js';

const makeOrder = (patch: Partial<PickingOrder> = {}): PickingOrder => ({
  _id: 'order-1',
  location: 'demo-store',
  channelOrderId: 'channel-1',
  channelOrderDisplayId: '#1001',
  customer: { name: 'Demo Customer' },
  items: [{ _id: 'line-1', plu: 'A', name: 'Milk', quantity: 1, price: 150, status: 'PENDING' }],
  status: 'SCHEDULED',
  pickerStatus: 'NOT_STARTED',
  receivedAt: '2026-09-27T08:00:00.000Z',
  dueAt: '2026-09-27T09:00:00.000Z',
  ...patch,
});

describe('QP-05 HeadsUp classification', () => {
  it('routes orders into the five display lanes', () => {
    expect(classifyHeadsUpOrder(makeOrder())).toBe('NEW');
    expect(classifyHeadsUpOrder(makeOrder({ pickerStatus: 'IN_PROGRESS' }))).toBe('PICKING');
    expect(classifyHeadsUpOrder(makeOrder({
      pickerStatus: 'IN_PROGRESS',
      items: [{ ...makeOrder().items[0], substitutionState: 'PENDING_CUSTOMER' }],
    }))).toBe('WAITING_APPROVAL');
    expect(classifyHeadsUpOrder(makeOrder({ pickerStatus: 'COMPLETED' }))).toBe('READY');
    expect(classifyHeadsUpOrder(makeOrder({
      pickerStatus: 'IN_PROGRESS',
      items: [{ ...makeOrder().items[0], syncState: 'FAILED' }],
    }))).toBe('EXCEPTIONS');
  });

  it('keeps line-level progress and exception counts visible', () => {
    const base = makeOrder().items[0];
    const order = makeOrder({
      items: [
        { ...base, status: 'PICKED' },
        { ...base, _id: 'line-2', status: 'REPLACED' },
        { ...base, _id: 'line-3', status: 'REMOVED' },
        { ...base, _id: 'line-4', status: 'PENDING', substitutionState: 'PENDING_CUSTOMER', syncState: 'FAILED' },
      ],
    });
    expect(getHeadsUpProgress(order)).toMatchObject({
      total: 4,
      handled: 3,
      picked: 1,
      replaced: 1,
      removed: 1,
      pendingSubstitutions: 1,
      failedSync: 1,
    });
  });

  it('calculates SLA labels from an injected clock', () => {
    expect(getHeadsUpDueState(
      makeOrder({ dueAt: '2026-09-27T09:00:00.000Z' }),
      Date.parse('2026-09-27T08:56:00.000Z')
    )).toMatchObject({ minutes: 4, level: 'CRITICAL', label: '4m left' });
  });
});

describe('QP-05 printer seam', () => {
  it('captures demo jobs without claiming hardware output', async () => {
    const provider = new MockPrinterProvider();
    const result = await provider.print({
      id: 'job-1',
      printerId: 'demo-receipt',
      purpose: 'RECEIPT',
      title: 'Order #1001',
      lines: ['Milk x1'],
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('mock');
    expect(provider.jobs).toHaveLength(1);
    expect(provider.jobs[0].lines).toEqual(['Milk x1']);
  });
});
