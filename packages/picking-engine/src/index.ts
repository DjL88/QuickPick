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
  isPickingLinePickable,
  RemovalReason,
} from '../../contracts/src/index.js';

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
    const group = order.groups?.find((g) => g.id === groupId);
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

    const changedItemIds: string[] = [];
    const now = new Date().toISOString();

    const newItems = order.items.map((item) => {
      if (item.groupId === groupId || getGroupLineIds(group).includes(item._id)) {
        if (item.isTextInstruction || item.status === 'PICKED') {
          return item;
        }

        const blockReasons = getPickAllBlockReasonsForLine(item, order.groups || [group]);
        if (blockReasons.length === 0) {
          changedItemIds.push(item._id);
          return {
            ...item,
            pickedQuantity: item.quantity || 1,
            status: 'PICKED' as const,
            pickedAt: now,
            syncState: 'SYNCED' as const,
          };
        }
      }
      return item;
    });

    // Update group statistics
    const updatedGroups = order.groups?.map((g) => {
      if (g.id === groupId) {
        const grpItems = newItems.filter(
          (it) => it.groupId === g.id || getGroupLineIds(g).includes(it._id)
        );
        const pickableGrpItems = grpItems.filter(isPickingLinePickable);
        const pickedCount = pickableGrpItems.filter((it) => it.status === 'PICKED').length;
        return {
          ...g,
          pickedCount,
          totalCount: pickableGrpItems.length,
        };
      }
      return g;
    });

    const updatedOrder: PickingOrder = {
      ...order,
      items: newItems,
      groups: updatedGroups,
      pickerStatus: 'IN_PROGRESS',
    };

    return {
      order: updatedOrder,
      actionTaken: 'PICK_ALL_GROUP',
      changedItemIds,
      changedGroupIds: [groupId],
      success: true,
      message: `Picked ${changedItemIds.length} safe items in group ${group.name}`,
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
    const grpItems = order.items.filter(
      (i) => i.groupId === groupId || (group ? getGroupLineIds(group).includes(i._id) : false)
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
}
