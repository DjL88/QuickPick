/**
 * @file src/components/OrderGroupRail.tsx
 * QP-02 / QP-04 Order Group & Bundle Rail:
 * Displays bundle/meal deal context, bundle progress (e.g. 2/4),
 * component roles (COMPONENT, MODIFIER, CUSTOMISATION, UPSELL, ADD_ON),
 * text instructions, and Safe Pick All action.
 */

import React from 'react';
import { Layers, Sparkles, Check, AlertCircle, Info, ChevronRight, CheckCircle2 } from 'lucide-react';
import { PickingGroup, PickingItem, getPickAllBlockReasons } from '@contracts/index.js';
import { HoldToConfirmButton } from './HoldToConfirmButton.js';
import { buildGroupPickAllPlan } from '../lib/pickAllGuard.js';

interface OrderGroupRailProps {
  groups?: PickingGroup[];
  items: PickingItem[];
  activeItemId?: string;
  onSelectGroupItem?: (itemId: string) => void;
  onPickAllSafeGroupItems?: (group: PickingGroup, safeItems: PickingItem[]) => void;
}

export const OrderGroupRail: React.FC<OrderGroupRailProps> = ({
  groups,
  items,
  activeItemId,
  onSelectGroupItem,
  onPickAllSafeGroupItems,
}) => {
  if (!groups || groups.length === 0) return null;

  return (
    <div className="space-y-2 mb-2.5">
      {groups.map((group) => {
        const groupItems = items.filter((item) => item.groupId === group.id || group.itemIds.includes(item._id));
        const pickableItems = groupItems.filter((item) => !item.isTextInstruction);
        const pickedCount = pickableItems.filter((item) => item.status === 'PICKED').length;
        const totalCount = pickableItems.length;
        const isGroupComplete = totalCount > 0 && pickedCount === totalCount;

        // Determine safe items for Pick All using a fingerprinted plan.
        // The fingerprint is checked again after the hold gesture so an SSE/live
        // change cannot silently bulk-pick stale item state.
        const pendingPickableItems = pickableItems.filter((item) => item.status === 'PENDING');
        const pickAllPlan = buildGroupPickAllPlan(group, groupItems);
        const safePendingItems = pendingPickableItems.filter((item) =>
          pickAllPlan.eligibleItemIds.includes(item._id)
        );
        const hasUnsafeItems = pickAllPlan.blockedItems.length > 0;

        const canPickAll =
          group.pickAllPolicy === 'SAFE_CHILDREN_ONLY' &&
          safePendingItems.length > 0;

        return (
          <div
            key={group.id}
            className={`rounded-lg border transition ${
              isGroupComplete
                ? 'bg-emerald-50/40 border-emerald-200/90'
                : 'bg-white border-neutral-200/90 shadow-xs'
            } p-3`}
          >
            {/* Group Header */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                    isGroupComplete
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {isGroupComplete ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : (
                    <Layers className="w-3.5 h-3.5" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-semibold text-neutral-900 truncate">
                      {group.name}
                    </h4>
                    {group.type && (
                      <span className="text-[10px] font-medium uppercase px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 border border-neutral-200 shrink-0">
                        {group.type.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    {pickedCount} of {totalCount} bundle components picked
                  </span>
                </div>
              </div>

              {/* Safe Group Pick All button */}
              {canPickAll && onPickAllSafeGroupItems && !isGroupComplete && (
                <HoldToConfirmButton
                  guardKey={pickAllPlan.fingerprint}
                  holdMs={650}
                  onConfirm={() => {
                    // Rebuild against the latest render before handing work to App.
                    const latestPlan = buildGroupPickAllPlan(group, items);
                    const latestSafeItems = items.filter((item) =>
                      latestPlan.eligibleItemIds.includes(item._id)
                    );
                    if (latestSafeItems.length > 0) {
                      onPickAllSafeGroupItems(group, latestSafeItems);
                    }
                  }}
                  className="min-h-[48px] px-3 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-medium flex items-center justify-center transition active:scale-[0.98] shrink-0"
                  title={
                    hasUnsafeItems
                      ? `Hold to pick ${safePendingItems.length} safe items; unsafe items stay individual`
                      : `Hold to pick all ${safePendingItems.length} eligible items`
                  }
                  label={
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Hold · Pick safe ({safePendingItems.length})</span>
                    </span>
                  }
                />
              )}
            </div>

            {/* Components Progress Mini-List */}
            <div className="divide-y divide-neutral-100 bg-neutral-50/70 rounded-md border border-neutral-200/60 overflow-hidden">
              {groupItems.map((item) => {
                const isPicked = item.status === 'PICKED';
                const isActive = item._id === activeItemId;
                const blockReasons = getPickAllBlockReasons(item, group);
                const isSafe = blockReasons.length === 0;

                return (
                  <div
                    key={item._id}
                    onClick={() => !item.isTextInstruction && onSelectGroupItem?.(item._id)}
                    className={`px-2.5 py-1.5 flex items-center justify-between text-xs transition ${
                      isActive ? 'bg-white ring-1 ring-emerald-500 font-medium' : ''
                    } ${
                      item.isTextInstruction ? 'italic text-neutral-500 bg-neutral-100/50' : 'cursor-pointer hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      {/* Status indicator */}
                      {item.isTextInstruction ? (
                        <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      ) : isPicked ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3] shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-neutral-300 shrink-0" />
                      )}

                      {/* Component Role Badge & Name */}
                      <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                        {item.componentRole && (
                          <span
                            className={`text-[9px] uppercase px-1 py-0.2 rounded font-mono font-medium ${
                              item.componentRole === 'COMPONENT'
                                ? 'bg-neutral-200/80 text-neutral-700'
                                : item.componentRole === 'MODIFIER'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : item.componentRole === 'CUSTOMISATION'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : item.componentRole === 'UPSELL'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {item.componentRole}
                          </span>
                        )}

                        <span className={`truncate ${isPicked ? 'line-through text-neutral-400' : 'text-neutral-800'}`}>
                          {item.name}
                        </span>
                      </div>
                    </div>

                    {/* Unsafe reason / Weight / Age tag if any */}
                    <div className="flex items-center gap-1 shrink-0 text-[10px]">
                      {item.isWeight && (
                        <span className="text-amber-700 font-medium px-1 rounded bg-amber-50 border border-amber-200">
                          Weigh
                        </span>
                      )}
                      {item.ageRestricted && (
                        <span className="text-rose-700 font-semibold px-1 rounded bg-rose-50 border border-rose-200">
                          18+
                        </span>
                      )}
                      {item.isTextInstruction && (
                        <span className="text-neutral-400 font-normal">
                          Note only
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
