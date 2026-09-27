import type {
  AuditLogEntry,
  PickingGroup,
  PickingItem,
  PickingOrder,
  TemperatureZone,
} from './index.js';
import { getPickAllBlockReasons } from './index.js';

export interface GroupProgress {
  groupId: string;
  totalLines: number;
  handledLines: number;
  pickedLines: number;
  replacedLines: number;
  removedLines: number;
  pendingLines: number;
  partialLines: number;
  percentComplete: number;
  complete: boolean;
}

export interface BulkPickLineDecision {
  lineId: string;
  eligible: boolean;
  reasons: string[];
}

export interface BulkPickPlan {
  groupId: string;
  label: string;
  lineIds: string[];
  pendingLineIds: string[];
  eligibleLineIds: string[];
  blocked: BulkPickLineDecision[];
  allowed: boolean;
  confirmation: {
    required: true;
    holdMs: number;
    label: string;
  };
}

export interface BulkPickUndoSnapshot {
  lineId: string;
  status: PickingItem['status'];
  pickedQuantity?: number;
  pickedWeight?: number;
  pickedAt?: string;
  pickedBy?: string;
  syncState?: PickingItem['syncState'];
}

export interface BulkPickUndoToken {
  actionId: string;
  orderId: string;
  groupId: string;
  actor: string;
  createdAt: string;
  expiresAt: string;
  lineIds: string[];
  snapshots: BulkPickUndoSnapshot[];
  appliedPickedAt: string;
}

export interface BulkPickExecution {
  order: PickingOrder;
  undo: BulkPickUndoToken;
  auditEvents: AuditLogEntry[];
}

export interface BulkPickUndoExecution {
  order: PickingOrder;
  auditEvents: AuditLogEntry[];
}

export interface RouteHint {
  aisleSequence?: number;
  baySequence?: number;
  heavy?: boolean;
  fragile?: boolean;
}

export interface RouteSection {
  key: string;
  temperature: TemperatureZone;
  aisle: string;
  lineIds: string[];
}

export interface BatchOrderInput {
  order: PickingOrder;
  toteLabel: string;
}

export interface BatchPlacement {
  orderId: string;
  lineId: string;
  toteLabel: string;
  quantity: number;
}

export interface BatchPickStop {
  key: string;
  plu: string;
  gtin?: string;
  name: string;
  aisle: string;
  temperature: TemperatureZone;
  totalQuantity: number;
  lineIds: string[];
  placements: BatchPlacement[];
}

export interface ZoneTaskPlan {
  zoneId: string;
  label: string;
  temperature: TemperatureZone;
  lineIds: string[];
  pendingLines: number;
}

export class PickingEngineError extends Error {
  constructor(
    public readonly code:
      | 'GROUP_NOT_FOUND'
      | 'PICK_ALL_BLOCKED'
      | 'CONFIRMATION_REQUIRED'
      | 'NOTHING_TO_PICK'
      | 'UNDO_EXPIRED'
      | 'UNDO_CONFLICT',
    message: string
  ) {
    super(message);
    this.name = 'PickingEngineError';
  }
}

const TEMPERATURE_RANK: Record<TemperatureZone, number> = {
  AMBIENT: 0,
  CHILLED: 1,
  FROZEN: 2,
};

function normaliseTemperature(item: PickingItem): TemperatureZone {
  return item.temperature === 'CHILLED' || item.temperature === 'FROZEN'
    ? item.temperature
    : 'AMBIENT';
}

function extractNumber(value?: string): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const match = value.match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

/**
 * Returns every actionable line that belongs to a group, including nested
 * modifier/customisation/upsell/add-on child groups.
 */
export function collectGroupLineIds(groups: PickingGroup[], groupId: string): string[] {
  const byId = new Map(groups.map((group) => [group.id, group]));
  if (!byId.has(groupId)) {
    throw new PickingEngineError('GROUP_NOT_FOUND', `Unknown picking group: ${groupId}`);
  }

  const lineIds: string[] = [];
  const queue = [groupId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const current = byId.get(currentId);
    if (!current) continue;

    lineIds.push(...current.lineIds);

    const inferredChildren = groups
      .filter((group) => group.parentGroupId === currentId)
      .map((group) => group.id);

    queue.push(...unique([...(current.childGroupIds || []), ...inferredChildren]));
  }

  return unique(lineIds);
}

export function getGroupProgress(
  group: PickingGroup,
  items: PickingItem[],
  groups: PickingGroup[]
): GroupProgress {
  const lineIds = collectGroupLineIds(groups, group.id);
  const byId = new Map(items.map((item) => [item._id, item]));
  const lines = lineIds.map((lineId) => byId.get(lineId)).filter(Boolean) as PickingItem[];

  const pickedLines = lines.filter((item) => item.status === 'PICKED').length;
  const replacedLines = lines.filter((item) => item.status === 'REPLACED').length;
  const removedLines = lines.filter((item) => item.status === 'REMOVED').length;
  const pendingLines = lines.filter((item) => item.status === 'PENDING').length;
  const partialLines = lines.filter(
    (item) => item.status === 'PENDING' && (item.pickedQuantity || 0) > 0
  ).length;
  const handledLines = pickedLines + replacedLines + removedLines;
  const totalLines = lines.length;

  return {
    groupId: group.id,
    totalLines,
    handledLines,
    pickedLines,
    replacedLines,
    removedLines,
    pendingLines,
    partialLines,
    percentComplete: totalLines === 0 ? 100 : Math.round((handledLines / totalLines) * 100),
    complete: totalLines === 0 || handledLines === totalLines,
  };
}

function lineIsInIndividualOnlyGroup(
  lineId: string,
  groups: PickingGroup[],
  rootGroupId: string
): boolean {
  const allowedGroupIds = new Set<string>();
  const queue = [rootGroupId];

  while (queue.length > 0) {
    const groupId = queue.shift()!;
    if (allowedGroupIds.has(groupId)) continue;
    allowedGroupIds.add(groupId);

    const group = groups.find((candidate) => candidate.id === groupId);
    if (!group) continue;
    queue.push(
      ...(group.childGroupIds || []),
      ...groups.filter((candidate) => candidate.parentGroupId === groupId).map((candidate) => candidate.id)
    );
  }

  return groups.some(
    (group) =>
      allowedGroupIds.has(group.id) &&
      group.pickAllPolicy === 'INDIVIDUAL_ONLY' &&
      group.lineIds.includes(lineId)
  );
}

/**
 * Conservative bulk-pick gate. "Pick All" only becomes available when every
 * remaining child can be safely bulk-confirmed. Any scan, weight, age,
 * substitution or individual-verification requirement blocks the entire action.
 */
export function buildGroupPickAllPlan(
  group: PickingGroup,
  items: PickingItem[],
  groups: PickingGroup[],
  holdMs = 650
): BulkPickPlan {
  const lineIds = collectGroupLineIds(groups, group.id);
  const byId = new Map(items.map((item) => [item._id, item]));
  const pendingLineIds = lineIds.filter((lineId) => byId.get(lineId)?.status === 'PENDING');

  const decisions = pendingLineIds.map((lineId): BulkPickLineDecision => {
    const item = byId.get(lineId);
    const reasons = item ? [...getPickAllBlockReasons(item)] : ['NON_PICKABLE'];

    if (
      item &&
      lineIsInIndividualOnlyGroup(lineId, groups, group.id) &&
      !reasons.includes('INDIVIDUAL_VERIFICATION')
    ) {
      reasons.push('INDIVIDUAL_VERIFICATION');
    }

    return {
      lineId,
      eligible: reasons.length === 0,
      reasons,
    };
  });

  const blocked = decisions.filter((decision) => !decision.eligible);
  const eligibleLineIds = decisions.filter((decision) => decision.eligible).map((decision) => decision.lineId);
  const allowed = pendingLineIds.length > 0 && blocked.length === 0;

  return {
    groupId: group.id,
    label: group.label,
    lineIds,
    pendingLineIds,
    eligibleLineIds,
    blocked,
    allowed,
    confirmation: {
      required: true,
      holdMs,
      label:
        pendingLineIds.length === 1
          ? 'Hold to pick this item'
          : `Hold to pick all ${pendingLineIds.length} items`,
    },
  };
}

function cloneOrder(order: PickingOrder): PickingOrder {
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      gtin: item.gtin ? [...item.gtin] : item.gtin,
      subItems: item.subItems ? item.subItems.map((subItem) => ({ ...subItem })) : item.subItems,
      modifiers: item.modifiers ? item.modifiers.map((modifier) => ({ ...modifier })) : item.modifiers,
      customerSelectedSubstitutes: item.customerSelectedSubstitutes
        ? item.customerSelectedSubstitutes.map((candidate) => ({ ...candidate }))
        : item.customerSelectedSubstitutes,
      replacement: item.replacement ? { ...item.replacement } : item.replacement,
    })),
    groups: order.groups?.map((group) => ({
      ...group,
      lineIds: [...group.lineIds],
      childGroupIds: [...group.childGroupIds],
      instructions: group.instructions.map((instruction) => ({ ...instruction })),
    })),
  };
}

function makeAuditEvent(
  actionId: string,
  orderId: string,
  timestamp: string,
  actor: string,
  action: string,
  details: Record<string, any>
): AuditLogEntry {
  return {
    id: `audit_${actionId}_${action.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    orderId,
    timestamp,
    actor,
    action,
    details,
  };
}

/**
 * Applies a previously previewed Pick All plan. The caller must explicitly pass
 * confirmed=true after its long-press/confirmation UX. The returned undo token
 * is deliberately short-lived so the UI can offer an immediate "Undo" snackbar
 * before synchronising the mutation externally.
 */
export function executeGroupPickAll(
  order: PickingOrder,
  plan: BulkPickPlan,
  options: {
    actor: string;
    confirmed: boolean;
    now?: Date;
    undoWindowMs?: number;
    actionId?: string;
  }
): BulkPickExecution {
  if (!plan.allowed) {
    throw new PickingEngineError('PICK_ALL_BLOCKED', 'Pick All is blocked by one or more child requirements.');
  }
  if (!options.confirmed) {
    throw new PickingEngineError('CONFIRMATION_REQUIRED', 'Bulk pick requires explicit confirmation.');
  }
  if (plan.pendingLineIds.length === 0) {
    throw new PickingEngineError('NOTHING_TO_PICK', 'No pending lines remain in this group.');
  }

  const now = options.now || new Date();
  const timestamp = now.toISOString();
  const undoWindowMs = options.undoWindowMs ?? 8000;
  const actionId =
    options.actionId ||
    `bulk_${plan.groupId}_${timestamp.replace(/[^0-9]/g, '').slice(0, 17)}`;

  const nextOrder = cloneOrder(order);
  const byId = new Map(nextOrder.items.map((item) => [item._id, item]));
  const snapshots: BulkPickUndoSnapshot[] = [];

  for (const lineId of plan.pendingLineIds) {
    const item = byId.get(lineId);
    if (!item) continue;

    snapshots.push({
      lineId,
      status: item.status,
      pickedQuantity: item.pickedQuantity,
      pickedWeight: item.pickedWeight,
      pickedAt: item.pickedAt,
      pickedBy: item.pickedBy,
      syncState: item.syncState,
    });

    item.status = 'PICKED';
    item.pickedQuantity = item.quantity;
    item.pickedAt = timestamp;
    item.pickedBy = options.actor;
    item.syncState = 'PENDING';
  }

  const undo: BulkPickUndoToken = {
    actionId,
    orderId: order._id,
    groupId: plan.groupId,
    actor: options.actor,
    createdAt: timestamp,
    expiresAt: new Date(now.getTime() + undoWindowMs).toISOString(),
    lineIds: [...plan.pendingLineIds],
    snapshots,
    appliedPickedAt: timestamp,
  };

  return {
    order: nextOrder,
    undo,
    auditEvents: [
      makeAuditEvent(actionId, order._id, timestamp, options.actor, 'BULK_PICK_CONFIRMED', {
        groupId: plan.groupId,
        lineIds: [...plan.pendingLineIds],
        count: plan.pendingLineIds.length,
        undoExpiresAt: undo.expiresAt,
      }),
    ],
  };
}

/**
 * Restores a just-applied Pick All action only while its short undo window is
 * open and only when none of the affected lines has changed again since the
 * bulk action. This prevents Undo from trampling a later scan or substitution.
 */
export function undoGroupPickAll(
  order: PickingOrder,
  token: BulkPickUndoToken,
  options: { actor: string; now?: Date }
): BulkPickUndoExecution {
  const now = options.now || new Date();
  if (now.getTime() > new Date(token.expiresAt).getTime()) {
    throw new PickingEngineError('UNDO_EXPIRED', 'The Pick All undo window has expired.');
  }
  if (order._id !== token.orderId) {
    throw new PickingEngineError('UNDO_CONFLICT', 'Undo token belongs to a different order.');
  }

  const nextOrder = cloneOrder(order);
  const byId = new Map(nextOrder.items.map((item) => [item._id, item]));

  for (const snapshot of token.snapshots) {
    const item = byId.get(snapshot.lineId);
    if (
      !item ||
      item.status !== 'PICKED' ||
      item.pickedAt !== token.appliedPickedAt ||
      item.pickedBy !== token.actor
    ) {
      throw new PickingEngineError(
        'UNDO_CONFLICT',
        `Line ${snapshot.lineId} changed after Pick All and cannot be safely restored.`
      );
    }
  }

  for (const snapshot of token.snapshots) {
    const item = byId.get(snapshot.lineId)!;
    item.status = snapshot.status;
    item.pickedQuantity = snapshot.pickedQuantity;
    item.pickedWeight = snapshot.pickedWeight;
    item.pickedAt = snapshot.pickedAt;
    item.pickedBy = snapshot.pickedBy;
    item.syncState = snapshot.syncState;
  }

  const timestamp = now.toISOString();
  return {
    order: nextOrder,
    auditEvents: [
      makeAuditEvent(token.actionId, order._id, timestamp, options.actor, 'BULK_PICK_UNDONE', {
        originalActor: token.actor,
        groupId: token.groupId,
        lineIds: [...token.lineIds],
        count: token.lineIds.length,
      }),
    ],
  };
}

/**
 * Deterministic phone-friendly route order. Temperature/cold-chain remains the
 * primary constraint; within a zone, heavy lines are brought forward and
 * fragile lines are pushed late. Aisle/bay hints beat string parsing when a
 * store layout provides them.
 */
export function sortDeterministicRoute(
  items: PickingItem[],
  hintsByLineId: Record<string, RouteHint> = {}
): PickingItem[] {
  return [...items].sort((a, b) => {
    const tempDiff = TEMPERATURE_RANK[normaliseTemperature(a)] - TEMPERATURE_RANK[normaliseTemperature(b)];
    if (tempDiff !== 0) return tempDiff;

    const aHint = hintsByLineId[a._id] || {};
    const bHint = hintsByLineId[b._id] || {};
    const handlingRank = (hint: RouteHint) => (hint.fragile ? 2 : hint.heavy ? 0 : 1);
    const handlingDiff = handlingRank(aHint) - handlingRank(bHint);
    if (handlingDiff !== 0) return handlingDiff;

    const aisleA = aHint.aisleSequence ?? extractNumber(a.aisle);
    const aisleB = bHint.aisleSequence ?? extractNumber(b.aisle);
    if (aisleA !== aisleB) return aisleA - aisleB;

    const bayA = aHint.baySequence ?? extractNumber(a.shelf);
    const bayB = bHint.baySequence ?? extractNumber(b.shelf);
    if (bayA !== bayB) return bayA - bayB;

    const explicitSequenceDiff = (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER);
    if (explicitSequenceDiff !== 0) return explicitSequenceDiff;

    return a._id.localeCompare(b._id);
  });
}

export function buildRouteSections(
  items: PickingItem[],
  hintsByLineId: Record<string, RouteHint> = {}
): RouteSection[] {
  const sorted = sortDeterministicRoute(items, hintsByLineId);
  const sections: RouteSection[] = [];

  for (const item of sorted) {
    const temperature = normaliseTemperature(item);
    const aisle = item.aisle || 'Unknown location';
    const key = `${temperature}:${aisle}`;
    let section = sections.find((candidate) => candidate.key === key);
    if (!section) {
      section = { key, temperature, aisle, lineIds: [] };
      sections.push(section);
    }
    section.lineIds.push(item._id);
  }

  return sections;
}

/**
 * Produces one merged walking list for a small batch while keeping tote
 * placement accountable per order. Only pending/pickable physical lines are
 * included.
 */
export function buildBatchPickPlan(
  inputs: BatchOrderInput[],
  hintsByLineId: Record<string, RouteHint> = {}
): BatchPickStop[] {
  const merged = new Map<string, BatchPickStop>();
  const representative = new Map<string, PickingItem>();

  for (const { order, toteLabel } of inputs) {
    for (const item of order.items) {
      if (item.status !== 'PENDING' || item.pickable === false) continue;

      const temperature = normaliseTemperature(item);
      const aisle = item.aisle || 'Unknown location';
      const gtin = item.gtin?.[0];
      const identity = item.plu || gtin || item._id;
      const key = `${identity}|${temperature}|${aisle}`;

      let stop = merged.get(key);
      if (!stop) {
        stop = {
          key,
          plu: item.plu,
          gtin,
          name: item.name,
          aisle,
          temperature,
          totalQuantity: 0,
          lineIds: [],
          placements: [],
        };
        merged.set(key, stop);
        representative.set(key, item);
      }

      stop.totalQuantity += item.quantity;
      stop.lineIds.push(item._id);
      stop.placements.push({
        orderId: order._id,
        lineId: item._id,
        toteLabel,
        quantity: item.quantity,
      });
    }
  }

  const representativeItems = sortDeterministicRoute(
    Array.from(representative.values()),
    hintsByLineId
  );
  const rank = new Map(representativeItems.map((item, index) => [item._id, index]));

  return Array.from(merged.values()).sort((a, b) => {
    const aRepresentative = representative.get(a.key)!;
    const bRepresentative = representative.get(b.key)!;
    return (rank.get(aRepresentative._id) ?? 0) - (rank.get(bRepresentative._id) ?? 0);
  });
}

export function buildZoneTaskPlan(order: PickingOrder): ZoneTaskPlan[] {
  const zones = new Map<TemperatureZone, string[]>();

  for (const item of order.items) {
    if (item.status !== 'PENDING' || item.pickable === false) continue;
    const temperature = normaliseTemperature(item);
    const lineIds = zones.get(temperature) || [];
    lineIds.push(item._id);
    zones.set(temperature, lineIds);
  }

  return (['AMBIENT', 'CHILLED', 'FROZEN'] as TemperatureZone[])
    .filter((temperature) => (zones.get(temperature)?.length || 0) > 0)
    .map((temperature) => ({
      zoneId: temperature.toLowerCase(),
      label:
        temperature === 'AMBIENT'
          ? 'Ambient'
          : temperature === 'CHILLED'
            ? 'Chilled'
            : 'Frozen',
      temperature,
      lineIds: zones.get(temperature) || [],
      pendingLines: zones.get(temperature)?.length || 0,
    }));
}
