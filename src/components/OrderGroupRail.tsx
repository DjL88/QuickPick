/**
 * @file src/components/OrderGroupRail.tsx
 * QP-02 / QP-04 Order Group & Bundle Rail:
 * Displays bundle/meal deal context, bundle progress (e.g. 2/4),
 * component roles (COMPONENT, MODIFIER, CUSTOMISATION, UPSELL, ADD_ON),
 * text instructions, and Safe Pick All action.
 */

import React from 'react';
import { Layers, Sparkles, Check, AlertCircle, Info, ChevronRight, CheckCircle2 } from 'lucide-react';
import {
  PickingGroup,
  PickingItem,
  getPickAllBlockReasonsForLine,
  getPickingLineGroups,
  isPickingLinePickable,
} from '@contracts/index.js';
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
        const groupItems = items.filter((item) =>
          getPickingLineGroups(item, groups).some((candidate) => candidate.id === group.id)
        );
        const pickableItems = groupItems.filter(isPickingLinePickable);
        const pickedCount = pickableItems.filter((item) => item.status === 'PICKED').length;
        const totalCount = pickableItems.length;
        const isGroupComplete = totalCount > 0 && pickedCount === totalCount;

        // Determine safe items for Pick All using a fingerprinted plan.
        // The fingerprint is checked again after the hold gesture so an SSE/live
        // change cannot silently bulk-pick stale item state.
        const pendingPickableItems = pickableItems.filter((item) => item.status === 'PENDING');
        const pickAllPlan = buildGroupPickAllPlan(group, items, groups);
        const safePendingItems = pendingPickableItems.filter((item) =>
          pickAllPlan.eligibleItemIds.includes(item._id)
        );
        const hasUnsafeItems = pickAllPlan.blockedItems.length > 0;

        const canPickAll =
          group.pickAllPolicy === 'SAFE_CHILDREN_ONLY' &&
          safePendingItems.length > 0 &&
          !hasUnsafeItems;

        return (
          <div
            key={group.id}
            className={`ltx-card transition p-3 ${isGroupComplete ? 'ring-1 ring-emerald-200' : ''}`}
          >
            {/* Group Header */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                    isGroupComplete
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[var(--ltx-brand-soft)] text-[var(--ltx-brand)]'
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
                    <h4 className="ltx-display text-sm font-semibold text-[var(--ltx-ink)] truncate">
                      {group.name}
                    </h4>
                    {group.type && (
                      <span className="text-[9px] font-medium uppercase px-1.5 py-0.5 rounded-lg bg-[var(--ltx-brand-soft)] text-[var(--ltx-brand)] shrink-0">
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
                    const latestPlan = buildGroupPickAllPlan(group, items, groups);
                    if (latestPlan.blockedItems.length > 0) return;
                    const latestSafeItems = items.filter((item) =>
                      latestPlan.eligibleItemIds.includes(item._id)
                    );
                    if (latestSafeItems.length > 0) {
                      onPickAllSafeGroupItems(group, latestSafeItems);
                    }
                  }}
                  className="min-h-[48px] px-3 rounded-xl ltx-secondary text-xs font-semibold flex items-center justify-center transition active:scale-[0.98] shrink-0"
                  title={`Hold to pick all ${safePendingItems.length} remaining items`}
                  label={
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ltx-brand)]" />
                      <span>Hold · Pick all ({safePendingItems.length})</span>
                    </span>
                  }
                />
              )}
            </div>

            {/* Components Progress Mini-List */}
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800 ltx-card-quiet overflow-hidden">
              {groupItems.map((item) => {
                const isPicked = item.status === 'PICKED';
                const isActive = item._id === activeItemId;
                const blockReasons = getPickAllBlockReasonsForLine(item, groups);
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
                            className="text-[9px] uppercase px-1.5 py-0.5 rounded-lg font-mono font-medium bg-[var(--ltx-brand-soft)] text-[var(--ltx-brand)]"
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
