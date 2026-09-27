/**
 * @file packages/picking-engine/src/index.ts
 * QP-03 Group Picking Engine for QuickPick.
 * Authoritative picking logic, multi-quantity unit progression, group/bundle progression,
 * safe pick-all validation, substitutions, and state transitions.
 */

import {
  PickingOrder,
  PickingItem,
  PickingGroup,
  PickingTransitionResult,
  getPickAllBlockReasons,
  getPickAllBlockReasonsForLine,
  getGroupLineIds,
  getPickingLineGroups,
  isPickingLinePickable,
  RemovalReason,
  AuditLogEntry,
  TemperatureZone,
} from '../../contracts/src/index.js';


export interface RouteStop {
  itemId: string;
  aisle?: string;
  shelf?: string;
  temperature?: TemperatureZone;
  groupIds: string[];
}

export interface PickingRoutePlan {
  orderId: string;
  stops: RouteStop[];
  sections: Array<{
    key: string;
    label: string;
    temperature?: TemperatureZone;
    aisle?: string;
    itemIds: string[];
  }>;
}

export interface BatchTotePlan {
  orders: Array<{ orderId: string; toteId: string }>;
  stops: Array<{
    key: string;
    itemName: string;
    plu?: string;
    temperature?: TemperatureZone;
    aisle?: string;
    puts: Array<{ toteId: string; orderId: string; itemId: string; quantity: number }>;
  }>;
}

export interface ZonePickPlan {
  orderId: string;
  zones: Array<{
    zone: TemperatureZone | 'UNASSIGNED';
    itemIds: string[];
    complete: boolean;
  }>;
}

export interface PickingUndoToken {
  orderId: string;
  actionTaken: string;
  createdAt: string;
  before: PickingOrder;
  expectedAfterFingerprint: string;
}

const TEMP_RANK: Record<TemperatureZone | 'UNASSIGNED', number> = {
  AMBIENT: 0,
  CHILLED: 1,
  FROZEN: 2,
  UNASSIGNED: 3,
};

function lineBelongsToGroup(
  item: PickingItem,
  groupId: string,
  groups: PickingGroup[] = []
): boolean {
  return getPickingLineGroups(item, groups).some((group) => group.id === groupId);
}

function aisleSortValue(aisle?: string): [number, string] {
  if (!aisle) return [Number.MAX_SAFE_INTEGER, ''];
  const match = aisle.match(/\d+/);
  return [match ? Number(match[0]) : Number.MAX_SAFE_INTEGER - 1, aisle.toLowerCase()];
}

function routeCompare(a: PickingItem, b: PickingItem): number {
  const tempA = TEMP_RANK[a.temperature || 'UNASSIGNED'];
  const tempB = TEMP_RANK[b.temperature || 'UNASSIGNED'];
  if (tempA !== tempB) return tempA - tempB;

  const [aisleNumA, aisleTextA] = aisleSortValue(a.aisle);
  const [aisleNumB, aisleTextB] = aisleSortValue(b.aisle);
  if (aisleNumA !== aisleNumB) return aisleNumA - aisleNumB;
  if (aisleTextA !== aisleTextB) return aisleTextA.localeCompare(aisleTextB);

  const seqA = a.sequence ?? Number.MAX_SAFE_INTEGER;
  const seqB = b.sequence ?? Number.MAX_SAFE_INTEGER;
  if (seqA !== seqB) return seqA - seqB;
  return a._id.localeCompare(b._id);
}

function orderFingerprint(order: PickingOrder): string {
  return JSON.stringify({
    id: order._id,
    pickerStatus: order.pickerStatus,
    status: order.status,
    items: order.items.map((item) => ({
      id: item._id,
      status: item.status,
      quantity: item.quantity,
      pickedQuantity: item.pickedQuantity ?? 0,
      pickedWeight: item.pickedWeight ?? null,
      replacement: item.replacement ?? null,
      removalReason: item.removalReason ?? null,
      syncState: item.syncState ?? null,
    })),
  });
}

export class PickingEngine {
  /**
   * Transition order to IN_PROGRESS
   */
  public static startOrder(
    order: PickingOrder,
    pickerId: string,
    pickerName: string
  ): PickingTransitionResult {
    const updated: PickingOrder = {
      ...order,
      pickerStatus: 'IN_PROGRESS',
      startedAt: order.startedAt || new Date().toISOString(),
      assignedPickerId: pickerId,
      assignedPickerName: pickerName,
    };

    return {
      order: updated,
      actionTaken: 'START_ORDER',
      changedItemIds: [],
      changedGroupIds: [],
      success: true,
      message: `Order ${order.channelOrderDisplayId} started by ${pickerName}`,
    };
  }

  /**
   * Declare a unit picked for an item (step-by-step or pick all remaining)
   */
  public static declareUnit(
    order: PickingOrder,
    itemId: string,
    weight?: number,
    pickAll: boolean = false
  ): PickingTransitionResult {
    const itemIndex = order.items.findIndex((i) => i._id === itemId);
    if (itemIndex === -1) {
      return {
        order,
        actionTaken: 'DECLARE_UNIT',
        changedItemIds: [],
        changedGroupIds: [],
        success: false,
        message: `Item ${itemId} not found in order ${order._id}`,
      };
    }

    const item = order.items[itemIndex];
    const totalQty = item.quantity || 1;
    const prevPicked = item.pickedQuantity || 0;

    let newPicked = pickAll ? totalQty : Math.min(totalQty, prevPicked + 1);
    const isComplete = newPicked >= totalQty;

    const updatedItem: PickingItem = {
      ...item,
      pickedQuantity: newPicked,
      status: isComplete ? 'PICKED' : 'PENDING',
      pickedWeight: weight !== undefined ? weight : item.pickedWeight,
      pickedAt: isComplete ? new Date().toISOString() : item.pickedAt,
      syncState: 'SYNCED',
    };

    const newItems = [...order.items];
    newItems[itemIndex] = updatedItem;

    // Recalculate group progress if item belongs to a group
    let changedGroupIds: string[] = [];
    let updatedGroups = order.groups;

    if (order.groups && item.groupId) {
      updatedGroups = order.groups.map((grp) => {
        if (grp.id === item.groupId || getGroupLineIds(grp).includes(item._id)) {
          changedGroupIds.push(grp.id);
          const grpItems = newItems.filter(
            (it) => it.groupId === grp.id || getGroupLineIds(grp).includes(it._id)
          );
          const pickableGrpItems = grpItems.filter(isPickingLinePickable);
          const pickedCount = pickableGrpItems.filter((it) => it.status === 'PICKED').length;
          return {
            ...grp,
            pickedCount,
            totalCount: pickableGrpItems.length,
          };
        }
        return grp;
      });
    }

    const updatedOrder: PickingOrder = {
      ...order,
      items: newItems,
      groups: updatedGroups,
      pickerStatus: 'IN_PROGRESS',
    };

    return {
      order: updatedOrder,
      actionTaken: isComplete ? 'ITEM_PICKED_COMPLETE' : 'ITEM_UNIT_DECLARED',
      changedItemIds: [itemId],
      changedGroupIds,
      success: true,
      message: `Declared ${newPicked}/${totalQty} for ${item.name}`,
    };
  }

  /**
   * Safe Pick All for an entire PickingGroup (QP-02 / QP-03)
   * Only transitions lines with zero blocking reasons.
   */
  public static pickAllSafeGroup(
    order: PickingOrder,
    groupId: string
  ): PickingTransitionResult {
    const group = order.groups?.find((candidate) => candidate.id === groupId);
    if (!group) {
      return {
        order,
        actionTaken: 'PICK_ALL_GROUP',
        changedItemIds: [],
        changedGroupIds: [],
        success: false,
        message: `Group ${groupId} not found`,
      };
    }

    if (group.pickAllPolicy !== 'SAFE_CHILDREN_ONLY') {
      return {
        order,
        actionTaken: 'PICK_ALL_GROUP',
        changedItemIds: [],
        changedGroupIds: [],
        blockReasons: [`Group policy is ${group.pickAllPolicy || 'DISABLED'}`],
        success: false,
        message: `Group ${group.name} does not permit Pick All`,
      };
    }

    const groups = order.groups || [group];
    const pendingPhysical = order.items.filter(
      (item) =>
        lineBelongsToGroup(item, groupId, groups) &&
        isPickingLinePickable(item) &&
        item.status === 'PENDING'
    );

    if (pendingPhysical.length === 0) {
      return {
        order,
        actionTaken: 'PICK_ALL_GROUP',
        changedItemIds: [],
        changedGroupIds: [],
        success: false,
        message: `Group ${group.name} has no pending physical items`,
      };
    }

    const blocked = pendingPhysical.flatMap((item) =>
      getPickAllBlockReasonsForLine(item, groups).map(
        (reason) => `${item.name}: ${reason}`
      )
    );

    // Pick All is deliberately all-or-nothing. If one remaining physical child
    // requires scan, weight, age, substitution or other verification, the whole
    // group stays individual so the action cannot imply more verification than
    // actually happened.
    if (blocked.length > 0) {
      return {
        order,
        actionTaken: 'PICK_ALL_GROUP',
        changedItemIds: [],
        changedGroupIds: [],
        blockReasons: Array.from(new Set(blocked)),
        success: false,
        message: `Group ${group.name} requires individual handling`,
      };
    }

    const changedItemIds = pendingPhysical.map((item) => item._id);
    const changedSet = new Set(changedItemIds);
    const now = new Date().toISOString();

    const newItems = order.items.map((item) =>
      changedSet.has(item._id)
        ? {
            ...item,
            pickedQuantity: item.quantity || 1,
            status: 'PICKED' as const,
            pickedAt: now,
            syncState: 'SYNCED' as const,
          }
        : item
    );

    const updatedGroups = order.groups?.map((candidate) => {
      const candidateItems = newItems.filter(
        (item) =>
          lineBelongsToGroup(item, candidate.id, groups) &&
          isPickingLinePickable(item)
      );
      return {
        ...candidate,
        pickedCount: candidateItems.filter((item) => item.status === 'PICKED').length,
        totalCount: candidateItems.length,
      };
    });

    return {
      order: {
        ...order,
        items: newItems,
        groups: updatedGroups,
        pickerStatus: 'IN_PROGRESS',
      },
      actionTaken: 'PICK_ALL_GROUP',
      changedItemIds,
      changedGroupIds: [groupId],
      success: true,
      message: `Picked all ${changedItemIds.length} remaining items in group ${group.name}`,
    };
  }

  /**
   * Apply Item Substitution
   */
  public static substituteItem(
    order: PickingOrder,
    itemId: string,
    replacement: {
      plu: string;
      name: string;
      price: number;
      quantity: number;
      reason?: string;
      itemId?: string;
    }
  ): PickingTransitionResult {
    const itemIndex = order.items.findIndex((i) => i._id === itemId);
    if (itemIndex === -1) {
      return {
        order,
        actionTaken: 'SUBSTITUTE_ITEM',
        changedItemIds: [],
        changedGroupIds: [],
        success: false,
        message: `Item ${itemId} not found`,
      };
    }

    const item = order.items[itemIndex];
    const updatedItem: PickingItem = {
      ...item,
      status: 'REPLACED',
      replacement: {
        ...replacement,
        quantity: replacement.quantity || item.quantity || 1,
      },
      syncState: 'SYNCED',
      pickedAt: new Date().toISOString(),
    };

    const newItems = [...order.items];
    newItems[itemIndex] = updatedItem;

    return {
      order: { ...order, items: newItems },
      actionTaken: 'SUBSTITUTE_ITEM',
      changedItemIds: [itemId],
      changedGroupIds: item.groupId ? [item.groupId] : [],
      success: true,
      message: `Item ${item.name} substituted with ${replacement.name}`,
    };
  }

  /**
   * Adjust item quantity
   */
  public static adjustQuantity(
    order: PickingOrder,
    itemId: string,
    newQuantity: number
  ): PickingTransitionResult {
    const itemIndex = order.items.findIndex((i) => i._id === itemId);
    if (itemIndex === -1) {
      return {
        order,
        actionTaken: 'ADJUST_QUANTITY',
        changedItemIds: [],
        changedGroupIds: [],
        success: false,
        message: `Item ${itemId} not found`,
      };
    }

    const item = order.items[itemIndex];
    const updatedItem: PickingItem = {
      ...item,
      quantity: Math.max(0, newQuantity),
      status: newQuantity === 0 ? 'REMOVED' : item.status,
      pickedQuantity: Math.min(item.pickedQuantity || 0, newQuantity),
    };

    const newItems = [...order.items];
    newItems[itemIndex] = updatedItem;

    return {
      order: { ...order, items: newItems },
      actionTaken: 'ADJUST_QUANTITY',
      changedItemIds: [itemId],
      changedGroupIds: item.groupId ? [item.groupId] : [],
      success: true,
      message: `Adjusted quantity of ${item.name} to ${newQuantity}`,
    };
  }

  /**
   * Remove item from order
   */
  public static removeItem(
    order: PickingOrder,
    itemId: string,
    reason: RemovalReason = 'OUT_OF_STOCK'
  ): PickingTransitionResult {
    const itemIndex = order.items.findIndex((i) => i._id === itemId);
    if (itemIndex === -1) {
      return {
        order,
        actionTaken: 'REMOVE_ITEM',
        changedItemIds: [],
        changedGroupIds: [],
        success: false,
        message: `Item ${itemId} not found`,
      };
    }

    const item = order.items[itemIndex];
    const updatedItem: PickingItem = {
      ...item,
      status: 'REMOVED',
      removalReason: reason,
      syncState: 'SYNCED',
    };

    const newItems = [...order.items];
    newItems[itemIndex] = updatedItem;

    return {
      order: { ...order, items: newItems },
      actionTaken: 'REMOVE_ITEM',
      changedItemIds: [itemId],
      changedGroupIds: item.groupId ? [item.groupId] : [],
      success: true,
      message: `Removed ${item.name} (reason: ${reason})`,
    };
  }

  /**
   * Finalize and dispatch order
   */
  public static finalizeOrder(
    order: PickingOrder,
    courierCount?: number,
    courierNotes?: string
  ): PickingTransitionResult {
    const pendingItems = order.items.filter(
      (i) => !i.isTextInstruction && i.status === 'PENDING'
    );

    const updatedOrder: PickingOrder = {
      ...order,
      status: 'FINALIZED',
      pickerStatus: 'COMPLETED',
      completedAt: new Date().toISOString(),
      courierCount: courierCount !== undefined ? courierCount : order.courierCount || 1,
      courierNotes: courierNotes || order.courierNotes,
    };

    return {
      order: updatedOrder,
      actionTaken: 'FINALIZE_ORDER',
      changedItemIds: [],
      changedGroupIds: [],
      success: true,
      message: `Order ${order.channelOrderDisplayId} finalized successfully with ${pendingItems.length} pending items remaining`,
    };
  }

  /**
   * Reject order (cannot fulfill)
   */
  public static rejectOrder(
    order: PickingOrder,
    reason: string,
    reasonType: string = 'CANCEL_ORDER'
  ): PickingTransitionResult {
    const updatedOrder: PickingOrder = {
      ...order,
      status: 'CANCELLED',
      pickerStatus: 'REJECTED',
      metadata: {
        ...order.metadata,
        rejectionReason: reason,
        rejectionType: reasonType,
        rejectedAt: new Date().toISOString(),
      },
    };

    return {
      order: updatedOrder,
      actionTaken: 'REJECT_ORDER',
      changedItemIds: [],
      changedGroupIds: [],
      success: true,
      message: `Order ${order.channelOrderDisplayId} rejected: ${reason}`,
    };
  }

  /**
   * Evaluate group progress summary
   */
  public static evaluateGroupProgress(
    order: PickingOrder,
    groupId: string
  ): {
    total: number;
    picked: number;
    isComplete: boolean;
    safePendingCount: number;
    unsafePendingCount: number;
  } {
    const group = order.groups?.find((g) => g.id === groupId);
    const grpItems = order.items.filter((item) =>
      lineBelongsToGroup(item, groupId, order.groups || (group ? [group] : []))
    );
    const pickableItems = grpItems.filter(isPickingLinePickable);
    const picked = pickableItems.filter((i) => i.status === 'PICKED').length;
    const total = pickableItems.length;

    const pending = pickableItems.filter((i) => i.status === 'PENDING');
    let safePendingCount = 0;
    let unsafePendingCount = 0;

    for (const it of pending) {
      if (getPickAllBlockReasonsForLine(it, order.groups || (group ? [group] : [])).length === 0) {
        safePendingCount++;
      } else {
        unsafePendingCount++;
      }
    }

    return {
      total,
      picked,
      isComplete: total > 0 && picked === total,
      safePendingCount,
      unsafePendingCount,
    };
  }

  /**
   * Deterministic route plan: ambient -> chilled -> frozen, then aisle/shelf
   * sequence. No AI/provider dependency and no invented store geometry.
   */
  public static buildRoute(order: PickingOrder): PickingRoutePlan {
    const pending = order.items
      .filter((item) => isPickingLinePickable(item) && item.status === 'PENDING')
      .slice()
      .sort(routeCompare);

    const stops: RouteStop[] = pending.map((item) => ({
      itemId: item._id,
      aisle: item.aisle,
      shelf: item.shelf,
      temperature: item.temperature,
      groupIds: getPickingLineGroups(item, order.groups || []).map((group) => group.id),
    }));

    const sectionMap = new Map<string, PickingRoutePlan['sections'][number]>();
    for (const item of pending) {
      const key = `${item.temperature || 'UNASSIGNED'}|${item.aisle || 'Location not set'}`;
      let section = sectionMap.get(key);
      if (!section) {
        section = {
          key,
          label: [item.temperature, item.aisle || 'Location not set']
            .filter(Boolean)
            .join(' · '),
          temperature: item.temperature,
          aisle: item.aisle,
          itemIds: [],
        };
        sectionMap.set(key, section);
      }
      section.itemIds.push(item._id);
    }

    return { orderId: order._id, stops, sections: Array.from(sectionMap.values()) };
  }

  /**
   * Demo batch/tote planner. It does not mutate orders or claim a Deliverect
   * batch API: it only merges identical physical pick stops for picker guidance.
   */
  public static buildBatchTotePlan(orders: PickingOrder[]): BatchTotePlan {
    const toteOrders = orders.map((order, index) => ({
      orderId: order._id,
      toteId: String.fromCharCode(65 + index),
    }));
    const toteByOrder = new Map(toteOrders.map((entry) => [entry.orderId, entry.toteId]));
    const merged = new Map<string, BatchTotePlan['stops'][number]>();

    for (const order of orders) {
      for (const item of order.items.filter(
        (candidate) => isPickingLinePickable(candidate) && candidate.status === 'PENDING'
      )) {
        const key = [
          item.plu || item.channelItemId || item._id,
          item.temperature || 'UNASSIGNED',
          item.aisle || '',
          item.shelf || '',
        ].join('|');

        let stop = merged.get(key);
        if (!stop) {
          stop = {
            key,
            itemName: item.name,
            plu: item.plu || undefined,
            temperature: item.temperature,
            aisle: item.aisle,
            puts: [],
          };
          merged.set(key, stop);
        }

        stop.puts.push({
          toteId: toteByOrder.get(order._id)!,
          orderId: order._id,
          itemId: item._id,
          quantity: item.quantity || 1,
        });
      }
    }

    const stops = Array.from(merged.values()).sort((a, b) => {
      const itemA: PickingItem = {
        _id: a.key,
        plu: a.plu || '',
        name: a.itemName,
        quantity: 1,
        price: 0,
        status: 'PENDING',
        temperature: a.temperature,
        aisle: a.aisle,
      };
      const itemB: PickingItem = {
        _id: b.key,
        plu: b.plu || '',
        name: b.itemName,
        quantity: 1,
        price: 0,
        status: 'PENDING',
        temperature: b.temperature,
        aisle: b.aisle,
      };
      return routeCompare(itemA, itemB);
    });

    return { orders: toteOrders, stops };
  }

  /**
   * Lightweight zone concept for the demo. Temperature is the only zone truth
   * currently present in contracts, so unknown layout is explicit UNASSIGNED.
   */
  public static buildZonePlan(order: PickingOrder): ZonePickPlan {
    const zones: Array<TemperatureZone | 'UNASSIGNED'> = [
      'AMBIENT',
      'CHILLED',
      'FROZEN',
      'UNASSIGNED',
    ];

    return {
      orderId: order._id,
      zones: zones
        .map((zone) => {
          const items = order.items.filter(
            (item) =>
              isPickingLinePickable(item) &&
              (item.temperature || 'UNASSIGNED') === zone
          );
          return {
            zone,
            itemIds: items.map((item) => item._id),
            complete:
              items.length > 0 &&
              items.every((item) => item.status !== 'PENDING'),
          };
        })
        .filter((zone) => zone.itemIds.length > 0),
    };
  }

  public static createUndoToken(
    before: PickingOrder,
    transition: PickingTransitionResult
  ): PickingUndoToken | null {
    if (!transition.success || transition.order._id !== before._id) return null;
    return {
      orderId: before._id,
      actionTaken: transition.actionTaken,
      createdAt: new Date().toISOString(),
      before: structuredClone(before),
      expectedAfterFingerprint: orderFingerprint(transition.order),
    };
  }

  /**
   * Conflict-safe local undo. Undo is rejected if the order has changed since
   * the transition, preventing one picker from overwriting another picker's work.
   * This is an internal demo state helper, not an undocumented Deliverect unpick API.
   */
  public static undo(
    current: PickingOrder,
    token: PickingUndoToken
  ): PickingTransitionResult {
    if (current._id !== token.orderId) {
      return {
        order: current,
        actionTaken: 'UNDO',
        changedItemIds: [],
        changedGroupIds: [],
        success: false,
        message: 'Undo token belongs to another order',
      };
    }

    if (orderFingerprint(current) !== token.expectedAfterFingerprint) {
      return {
        order: current,
        actionTaken: 'UNDO',
        changedItemIds: [],
        changedGroupIds: [],
        success: false,
        message: 'Order changed after this action; undo is no longer safe',
      };
    }

    return {
      order: structuredClone(token.before),
      actionTaken: 'UNDO',
      changedItemIds: [],
      changedGroupIds: [],
      success: true,
      message: `Undid ${token.actionTaken}`,
    };
  }

  public static toAuditLog(
    orderId: string,
    actor: string,
    transition: PickingTransitionResult
  ): AuditLogEntry {
    return {
      id: `audit_${orderId}_${Date.now()}`,
      orderId,
      timestamp: new Date().toISOString(),
      actor,
      action: transition.actionTaken,
      details: {
        success: transition.success,
        changedItemIds: transition.changedItemIds,
        changedGroupIds: transition.changedGroupIds,
        blockReasons: transition.blockReasons,
        message: transition.message,
      },
    };
  }

}
