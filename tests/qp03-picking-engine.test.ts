import { describe, expect, it } from 'vitest';
import type { PickingGroup, PickingItem, PickingOrder } from '../packages/contracts/src/index.js';
import {
  buildBatchPickPlan,
  buildGroupPickAllPlan,
  buildZoneTaskPlan,
  executeGroupPickAll,
  getGroupProgress,
  sortDeterministicRoute,
  undoGroupPickAll,
} from '../packages/contracts/src/picking-engine.js';
import { groupedDemo } from '../packages/mock-deliverect/src/qp02-fixture.js';

const item = (id: string, plu: string, extra: Partial<PickingItem> = {}): PickingItem => ({
  _id: id,
  plu,
  name: id,
  quantity: 1,
  price: 100,
  status: 'PENDING',
  pickable: true,
  identitySource: 'SOURCE',
  temperature: 'AMBIENT',
  ...extra,
});

const order = (id: string, items: PickingItem[], groups: PickingGroup[] = []): PickingOrder => ({
  _id: id,
  location: 'demo',
  channelOrderId: id,
  channelOrderDisplayId: id,
  customer: { name: 'Demo' },
  items,
  groups,
  status: 'SCHEDULED',
  pickerStatus: 'IN_PROGRESS',
  receivedAt: '2026-09-27T08:00:00.000Z',
  dueAt: '2026-09-27T09:00:00.000Z',
});

describe('QP-03 picking engine', () => {
  it('reports nested progress for the grouped demo', () => {
    const deal = groupedDemo.groups.find((group) => group.type === 'DEAL')!;
    const changed = groupedDemo.items.map((line) =>
      line._id === 'demo-main' ? { ...line, status: 'PICKED' as const } : line
    );

    expect(getGroupProgress(deal, changed, groupedDemo.groups)).toMatchObject({
      totalLines: 7,
      handledLines: 1,
      pendingLines: 6,
      complete: false,
    });
  });

  it('blocks Pick All when any remaining child needs individual handling', () => {
    const deal = groupedDemo.groups.find((group) => group.type === 'DEAL')!;
    const plan = buildGroupPickAllPlan(deal, groupedDemo.items, groupedDemo.groups);

    expect(plan.allowed).toBe(false);
    expect(plan.confirmation.holdMs).toBe(650);
    expect(plan.blocked.find((entry) => entry.lineId === 'demo-side')?.reasons)
      .toContain('SCAN_REQUIRED');
    expect(plan.blocked.find((entry) => entry.lineId === 'demo-weight')?.reasons)
      .toContain('WEIGHT_REQUIRED');
    expect(plan.blocked.find((entry) => entry.lineId === 'demo-age')?.reasons)
      .toContain('AGE_CHECK_REQUIRED');
  });

  it('applies and restores a safe confirmed Pick All', () => {
    const lines = [item('safe-a', 'A', { quantity: 2 }), item('safe-b', 'B')];
    const group: PickingGroup = {
      id: 'safe',
      type: 'BUNDLE',
      label: 'Safe bundle',
      lineIds: lines.map((line) => line._id),
      childGroupIds: [],
      instructions: [],
      pickAllPolicy: 'SAFE_CHILDREN_ONLY',
    };
    const source = order('safe-order', lines, [group]);
    const plan = buildGroupPickAllPlan(group, source.items, source.groups!);

    expect(plan.allowed).toBe(true);

    const applied = executeGroupPickAll(source, plan, {
      actor: 'Alex',
      confirmed: true,
      now: new Date('2026-09-27T08:10:00.000Z'),
      actionId: 'bulk-demo',
    });

    expect(applied.order.items.map((line) => line.status)).toEqual(['PICKED', 'PICKED']);
    expect(applied.order.items[0].pickedQuantity).toBe(2);
    expect(applied.auditEvents[0].action).toBe('BULK_PICK_CONFIRMED');

    const restored = undoGroupPickAll(applied.order, applied.undo, {
      actor: 'Alex',
      now: new Date('2026-09-27T08:10:05.000Z'),
    });

    expect(restored.order.items.map((line) => line.status)).toEqual(['PENDING', 'PENDING']);
    expect(restored.auditEvents[0].action).toBe('BULK_PICK_UNDONE');
  });

  it('sorts heavy ambient first, fragile ambient late, then chilled and frozen', () => {
    const lines = [
      item('fragile', 'F', { aisle: 'Aisle 1' }),
      item('normal', 'N', { aisle: 'Aisle 2' }),
      item('heavy', 'H', { aisle: 'Aisle 9' }),
      item('chilled', 'C', { temperature: 'CHILLED' }),
      item('frozen', 'Z', { temperature: 'FROZEN' }),
    ];

    const sorted = sortDeterministicRoute(lines, {
      heavy: { heavy: true },
      fragile: { fragile: true },
    });

    expect(sorted.map((line) => line._id)).toEqual([
      'heavy',
      'normal',
      'fragile',
      'chilled',
      'frozen',
    ]);
  });

  it('merges batch quantities while preserving tote placements', () => {
    const first = order('one', [item('one-milk', 'MILK', { quantity: 2, aisle: 'Aisle 5', temperature: 'CHILLED' })]);
    const second = order('two', [item('two-milk', 'MILK', { quantity: 1, aisle: 'Aisle 5', temperature: 'CHILLED' })]);

    const plan = buildBatchPickPlan([
      { order: first, toteLabel: 'A' },
      { order: second, toteLabel: 'B' },
    ]);

    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ plu: 'MILK', totalQuantity: 3 });
    expect(plan[0].placements.map((entry) => entry.toteLabel)).toEqual(['A', 'B']);
  });

  it('splits pending work into simple temperature zones', () => {
    const source = order('zones', [
      item('ambient', 'A'),
      item('chilled', 'C', { temperature: 'CHILLED' }),
      item('frozen', 'F', { temperature: 'FROZEN' }),
    ]);

    expect(buildZoneTaskPlan(source).map((zone) => zone.zoneId)).toEqual([
      'ambient',
      'chilled',
      'frozen',
    ]);
  });
});
