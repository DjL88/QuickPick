/**
 * @file src/components/SubstitutionModal.tsx
 * Comprehensive item issue dialog strictly enforcing Deliverect itemUnavailableActions rules:
 * - ITEM_AMENDMENT -> quantity adjust allowed
 * - ITEM_REMOVE -> remove allowed with reason
 * - ITEM_SUBSTITUTION / ITEM_SUBSTITUTION_CATALOG -> replace allowed (suggested + search + price diff)
 * - CANCEL_ORDER -> offer full order cancellation
 * - Absent field -> allows with warning banner
 */

import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Search,
  Check,
  X,
  AlertTriangle,
  Trash2,
  Sliders,
  DollarSign,
  Ban,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { PickingItem, ItemUnavailableAction, RemovalReason } from '@contracts/index.js';
import { sounds } from '../lib/audio.js';

interface SubstitutionModalProps {
  orderId: string;
  item: PickingItem;
  onReplace: (replacement: { plu: string; name: string; price: number; quantity: number; reason?: string }) => void;
  onAdjustQuantity: (newQuantity: number) => void;
  onRemove: (reason: RemovalReason) => void;
  onRequestCancelOrder: () => void;
  onClose: () => void;
}

export const SubstitutionModal: React.FC<SubstitutionModalProps> = ({
  orderId,
  item,
  onReplace,
  onAdjustQuantity,
  onRemove,
  onRequestCancelOrder,
  onClose,
}) => {
  const actions = item.itemUnavailableActions;
  const isAbsent = !actions || actions.length === 0;

  const canReplace = isAbsent || actions.includes('ITEM_SUBSTITUTION') || actions.includes('ITEM_SUBSTITUTION_CATALOG');
  const canAdjust = isAbsent || actions.includes('ITEM_AMENDMENT');
  const canRemove = isAbsent || actions.includes('ITEM_REMOVE');
  const canCancelOrder = !isAbsent && actions.includes('CANCEL_ORDER');

  // Determine initial active tab
  const [activeTab, setActiveTab] = useState<'replace' | 'adjust' | 'remove'>(
    canReplace ? 'replace' : canAdjust ? 'adjust' : 'remove'
  );

  // Replace sub-state
  const [suggestedSubstitutes, setSuggestedSubstitutes] = useState<any[]>([]);
  const [isLoadingSubs, setIsLoadingSubs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customReason, setCustomReason] = useState('OUT_OF_STOCK');

  // Adjust sub-state
  const [adjustedQty, setAdjustedQty] = useState(Math.max(1, item.quantity - 1));

  // Remove sub-state
  const [removalReason, setRemovalReason] = useState<RemovalReason>('OUT_OF_STOCK');

  useEffect(() => {
    if (canReplace) {
      setIsLoadingSubs(true);
      fetch(`/api/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(item._id)}/substitutes?reason=OUT_OF_STOCK`)
        .then((r) => r.json())
        .then((data) => {
          setSuggestedSubstitutes(data.substitutes || []);
        })
        .catch((err) => console.warn('Failed to load substitutes:', err))
        .finally(() => setIsLoadingSubs(false));
    }
  }, [orderId, item._id, canReplace]);

  // Filter substitutes by search query
  const filteredSubstitutes = suggestedSubstitutes.filter((sub) =>
    sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.plu.includes(searchQuery)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Item Issue & Resolution</h3>
              <p className="text-xs text-slate-500 line-clamp-1">{item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Banner if Absent or Strict */}
        {isAbsent ? (
          <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Actions unspecified. Modifications permitted with caution.</span>
          </div>
        ) : !canReplace ? (
          <div className="px-3.5 py-2 bg-rose-50 border-b border-rose-200 flex items-center gap-2 text-xs text-rose-800">
            <Ban className="w-4 h-4 shrink-0 text-rose-600" />
            <span>Customer Preference: Substitutions disallowed for this item.</span>
          </div>
        ) : null}

        {/* Action Selection Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-1 gap-1 text-xs">
          <button
            onClick={() => setActiveTab('replace')}
            disabled={!canReplace}
            className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'replace'
                ? 'bg-white text-slate-900 shadow-xs'
                : canReplace
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 cursor-not-allowed opacity-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Substitute</span>
          </button>

          <button
            onClick={() => setActiveTab('adjust')}
            disabled={!canAdjust}
            className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'adjust'
                ? 'bg-white text-slate-900 shadow-xs'
                : canAdjust
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 cursor-not-allowed opacity-50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Adjust Qty</span>
          </button>

          <button
            onClick={() => setActiveTab('remove')}
            disabled={!canRemove}
            className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'remove'
                ? 'bg-white text-slate-900 shadow-xs'
                : canRemove
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 cursor-not-allowed opacity-50'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {/* TAB 1: SUBSTITUTE */}
          {activeTab === 'replace' && canReplace && (
            <div className="space-y-2.5">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search store inventory..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Substitute list */}
              {isLoadingSubs ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  <div className="animate-spin w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-2" />
                  Finding catalog matches...
                </div>
              ) : filteredSubstitutes.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                    Suggested Replacements
                  </span>
                  {filteredSubstitutes.map((sub, idx) => {
                    const priceDiff = sub.price - item.price;
                    const diffText =
                      priceDiff === 0
                        ? 'Same price'
                        : priceDiff > 0
                        ? `+£${(priceDiff / 100).toFixed(2)}`
                        : `-£${(Math.abs(priceDiff) / 100).toFixed(2)}`;

                    return (
                      <div
                        key={sub.plu || idx}
                        className="p-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-between transition shadow-xs"
                      >
                        <div className="pr-2 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold text-slate-900">{sub.name}</span>
                            {sub.similarity && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {Math.round(sub.similarity * 100)}% match
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="font-mono">PLU: {sub.plu}</span>
                            <span>·</span>
                            <span className="font-medium text-slate-800">£{(sub.price / 100).toFixed(2)}</span>
                            <span>·</span>
                            <span className="font-semibold text-emerald-700">({diffText})</span>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            sounds.playPickSuccess();
                            onReplace({
                              plu: sub.plu,
                              name: sub.name,
                              price: sub.price,
                              quantity: item.quantity,
                              reason: customReason,
                            });
                          }}
                          className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 shadow-xs transition active:scale-95 shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" /> Select
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-200">
                  No substitutes found matching your query.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADJUST QUANTITY */}
          {activeTab === 'adjust' && canAdjust && (
            <div className="space-y-3 py-1">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center">
                <span className="text-xs text-slate-500 block mb-1">Adjust Picked Quantity</span>
                <div className="flex items-center justify-center gap-5 my-2">
                  <button
                    onClick={() => setAdjustedQty(Math.max(0, adjustedQty - 1))}
                    className="w-9 h-9 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-lg flex items-center justify-center transition"
                  >
                    -
                  </button>
                  <span className="text-2xl font-bold font-mono text-slate-900">{adjustedQty}</span>
                  <button
                    onClick={() => setAdjustedQty(adjustedQty + 1)}
                    className="w-9 h-9 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-lg flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Original: <span className="font-bold text-slate-800">{item.quantity}</span> units
                </p>
              </div>

              <button
                onClick={() => {
                  sounds.playPickSuccess();
                  onAdjustQuantity(adjustedQty);
                }}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-98"
              >
                <Check className="w-4 h-4" />
                Apply Quantity Adjustment ({adjustedQty} units)
              </button>
            </div>
          )}

          {/* TAB 3: REMOVE ITEM */}
          {activeTab === 'remove' && canRemove && (
            <div className="space-y-3 py-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Select Removal Reason:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'OUT_OF_STOCK', label: 'Out of Stock' },
                    { key: 'DAMAGED', label: 'Damaged / Spoiled' },
                    { key: 'EXPIRED', label: 'Past Expiry Date' },
                    { key: 'CUSTOMER_REQUEST', label: 'Customer Request' },
                  ].map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setRemovalReason(r.key as RemovalReason)}
                      className={`p-2.5 rounded-lg border text-left text-xs font-semibold transition ${
                        removalReason === r.key
                          ? 'bg-rose-50 border-rose-300 text-rose-800'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  sounds.playPickSuccess();
                  onRemove(removalReason);
                }}
                className="w-full py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-98"
              >
                <Trash2 className="w-4 h-4" />
                Confirm Item Removal
              </button>
            </div>
          )}

          {/* Special CANCEL ORDER option if order is critical */}
          {canCancelOrder && (
            <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-rose-800 block">Cancel Entire Order?</span>
                <span className="text-[11px] text-slate-500">
                  Item marked essential under CANCEL_ORDER action.
                </span>
              </div>
              <button
                onClick={onRequestCancelOrder}
                className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition shrink-0"
              >
                Reject Order
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-right">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
