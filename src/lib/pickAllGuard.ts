/**
 * @file src/lib/pickAllGuard.ts
 * Pure safety planning for QuickPick bulk-pick affordances.
 *
 * The UI may preview a "Pick All" action, but the order can change while a picker
 * is holding the confirmation control (SSE, another picker, substitution state,
 * offline replay, etc). These helpers make that preview fingerprint explicit so
 * callers can reject a stale confirmation instead of bulk-picking old state.
 */

import {
  PickingGroup,
  PickingItem,
  getPickAllBlockReasons,
} from '@contracts/index.js';

export interface GroupPickAllBlockedItem {
  itemId: string;
  reasons: string[];
}

export interface GroupPickAllPlan {
  groupId: string;
  eligibleItemIds: string[];
  blockedItems: GroupPickAllBlockedItem[];
  fingerprint: string;
}

function stableItemState(item: PickingItem, group?: PickingGroup) {
  return {
    id: item._id,
    status: item.status,
    syncState: item.syncState ?? null,
    quantity: item.quantity ?? null,
    pickedQuantity: item.pickedQuantity ?? null,
    isWeight: Boolean(item.isWeight),
    ageRestricted: Boolean(item.ageRestricted),
    requiresBarcodeScan: Boolean(item.requiresBarcodeScan),
    requiresIndividualVerification: Boolean(item.requiresIndividualVerification),
    isTextInstruction: Boolean(item.isTextInstruction),
    hasReplacement: Boolean(item.replacement),
    blockReasons: getPickAllBlockReasons(item, group),
  };
}

export function buildItemPickAllFingerprint(
  item: PickingItem,
  group?: PickingGroup
): string {
  return JSON.stringify(stableItemState(item, group));
}

export function buildGroupPickAllPlan(
  group: PickingGroup,
  items: PickingItem[]
): GroupPickAllPlan {
  const groupItems = items
    .filter((item) => item.groupId === group.id || group.itemIds.includes(item._id))
    .sort((a, b) => a._id.localeCompare(b._id));

  const pendingPickable = groupItems.filter(
    (item) => item.status === 'PENDING' && !item.isTextInstruction
  );

  const eligibleItemIds: string[] = [];
  const blockedItems: GroupPickAllBlockedItem[] = [];

  for (const item of pendingPickable) {
    const reasons = getPickAllBlockReasons(item, group);
    if (reasons.length === 0) {
      eligibleItemIds.push(item._id);
    } else {
      blockedItems.push({ itemId: item._id, reasons });
    }
  }

  const fingerprint = JSON.stringify({
    groupId: group.id,
    policy: group.pickAllPolicy ?? null,
    items: groupItems.map((item) => stableItemState(item, group)),
  });

  return {
    groupId: group.id,
    eligibleItemIds,
    blockedItems,
    fingerprint,
  };
}

export function isGroupPickAllPlanCurrent(
  previousPlan: GroupPickAllPlan,
  group: PickingGroup,
  items: PickingItem[]
): boolean {
  const current = buildGroupPickAllPlan(group, items);
  return (
    current.fingerprint === previousPlan.fingerprint &&
    JSON.stringify(current.eligibleItemIds) ===
      JSON.stringify(previousPlan.eligibleItemIds)
  );
}
