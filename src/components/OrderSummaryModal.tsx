/**
 * @file src/components/OrderSummaryModal.tsx
 * Order completion review: clean summary of changes, courier count check, and finalization.
 * Calm typography, modern lines.
 */

import React, { useState } from 'react';
import { CheckCheck, X, Bike, AlertCircle, ShoppingBag, ArrowRight, ShieldAlert, UserCheck, CheckCircle2 } from 'lucide-react';
import { PickingOrder } from '@contracts/index.js';
import { CollectionAgeVerificationModal } from './commerce/CollectionAgeVerificationModal.js';

interface OrderSummaryModalProps {
  order: PickingOrder;
  onFinish: (courierCount: number, courierNotes?: string) => void;
  onRejectOrder: (reason: string, reasonType: string) => void;
  onOpenCouriersModal: () => void;
  onClose: () => void;
}

export const OrderSummaryModal: React.FC<OrderSummaryModalProps> = ({
  order,
  onFinish,
  onRejectOrder,
  onOpenCouriersModal,
  onClose,
}) => {
  const [courierNotes, setCourierNotes] = useState('');
  const [showRejectOptions, setShowRejectOptions] = useState(false);
  const [rejectReason, setRejectReason] = useState('Critical items out of stock');
  const [rejectReasonType, setRejectReasonType] = useState('CANCEL_ORDER');
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [handoverVerified, setHandoverVerified] = useState(false);

  const isCollection = order.orderType === 'PICKUP';
  const hasAgeRestrictedItems = order.items.some(
    (i) => i.ageRestricted || (i.minimumAge && i.minimumAge >= 18)
  );

  const pickedItems = order.items.filter((i) => i.status === 'PICKED');
  const replacedItems = order.items.filter((i) => i.status === 'REPLACED');
  const removedItems = order.items.filter((i) => i.status === 'REMOVED');
  const pendingItems = order.items.filter((i) => i.status === 'PENDING');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-xl bg-white border border-neutral-200/90 shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-700">
              <CheckCheck className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">
                Order Review · {order.channelOrderDisplayId}
              </h3>
              <p className="text-xs text-neutral-500">
                Customer: {order.customer.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3.5 text-xs">
          {/* Summary Stat Tiles */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-200/80">
              <span className="text-[10px] text-emerald-800 font-medium uppercase block">Picked</span>
              <span className="text-lg font-semibold font-mono text-emerald-900">{pickedItems.length}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-200/80">
              <span className="text-[10px] text-amber-800 font-medium uppercase block">Replaced</span>
              <span className="text-lg font-semibold font-mono text-amber-900">{replacedItems.length}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200/80">
              <span className="text-[10px] text-neutral-600 font-medium uppercase block">Removed</span>
              <span className="text-lg font-semibold font-mono text-neutral-800">{removedItems.length}</span>
            </div>
          </div>

          {/* Pending warning if any items not picked */}
          {pendingItems.length > 0 && (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200/80 flex items-center gap-2 text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                {pendingItems.length} item(s) are still pending declaration.
              </span>
            </div>
          )}

          {/* Item Review List */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-neutral-500 uppercase tracking-wide block">
              Items Breakdown
            </span>

            {order.items.map((item) => (
              <div
                key={item._id}
                className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200/80 flex items-center justify-between text-xs"
              >
                <div className="pr-2 min-w-0">
                  <div className="font-medium text-neutral-900 truncate max-w-[220px]">{item.name}</div>
                  <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                    <span>Qty: {item.quantity}</span>
                    {item.isWeight && item.pickedWeight && (
                      <span className="text-emerald-700 font-mono">({item.pickedWeight}kg)</span>
                    )}
                    {item.status === 'REPLACED' && item.replacement && (
                      <span className="text-amber-700 truncate">↳ Sub: {item.replacement.name}</span>
                    )}
                    {item.status === 'REMOVED' && (
                      <span className="text-rose-700">↳ Reason: {item.removalReason}</span>
                    )}
                  </div>
                </div>

                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-md border uppercase ${
                    item.status === 'PICKED'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : item.status === 'REPLACED'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : item.status === 'REMOVED'
                      ? 'bg-neutral-100 text-neutral-600 border-neutral-200'
                      : 'bg-white text-neutral-500 border-neutral-200'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>

          {/* Collection & Age Verification Requirement Banner */}
          {(isCollection || hasAgeRestrictedItems) && (
            <div className="p-3 rounded-xl bg-slate-900 text-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <div>
                    <span className="text-xs font-bold block">
                      {hasAgeRestrictedItems ? '18+ Age Restriction ID Verification' : 'Store Collection Verification'}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      DOB/Photo ID check + Customer Signature / Code required
                    </span>
                  </div>
                </div>

                {handoverVerified ? (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[11px] font-bold border border-rose-500/30">
                    Action Required
                  </span>
                )}
              </div>

              {!handoverVerified && (
                <button
                  type="button"
                  onClick={() => setShowAgeModal(true)}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Verify ID (DOB / Photo ID) & Sign On Screen</span>
                </button>
              )}
            </div>
          )}

          {/* Courier Count Check */}
          <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bike className="w-4 h-4 text-neutral-500" />
              <div>
                <span className="text-xs font-medium text-neutral-900 block">
                  Couriers: {order.courierCount || 1}
                </span>
                <span className="text-[11px] text-neutral-500">Deliverect delivery courier assignment</span>
              </div>
            </div>
            <button
              onClick={onOpenCouriersModal}
              className="text-xs px-2.5 py-1 rounded-md bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200 font-medium shadow-xs transition"
            >
              Adjust
            </button>
          </div>

          {/* Reject order toggle */}
          {showRejectOptions ? (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-800">Reject Entire Order</span>
                <button
                  onClick={() => setShowRejectOptions(false)}
                  className="text-xs text-neutral-500 hover:text-neutral-800"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="text-[11px] text-neutral-600 block mb-1">Reason for Rejection</label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full text-xs p-1.5 rounded-md bg-white border border-rose-300 text-neutral-900"
                >
                  <option value="Critical items out of stock">Critical items out of stock</option>
                  <option value="Store closing / Kitchen overload">Store closing / Kitchen overload</option>
                  <option value="Damaged inventory">Damaged inventory</option>
                  <option value="Customer requested cancellation">Customer requested cancellation</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-neutral-600 block mb-1">Deliverect Action</label>
                <select
                  value={rejectReasonType}
                  onChange={(e) => setRejectReasonType(e.target.value)}
                  className="w-full text-xs p-1.5 rounded-md bg-white border border-rose-300 text-neutral-900"
                >
                  <option value="CANCEL_ORDER">CANCEL_ORDER</option>
                  <option value="RETRY_LATER">RETRY_LATER</option>
                </select>
              </div>

              <button
                onClick={() => onRejectOrder(rejectReason, rejectReasonType)}
                className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-medium text-xs transition"
              >
                Confirm Rejection to Deliverect
              </button>
            </div>
          ) : (
            <div className="text-right">
              <button
                onClick={() => setShowRejectOptions(true)}
                className="text-[11px] text-neutral-400 hover:text-rose-600 transition"
              >
                Cannot fulfill this order? Reject order
              </button>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-3.5 border-t border-neutral-100 flex items-center justify-end gap-2 bg-neutral-50/50">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 font-medium text-xs transition"
          >
            Back to Pick
          </button>

          <button
            onClick={() => onFinish(order.courierCount || 1, courierNotes)}
            className="px-4 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition"
          >
            <span>Complete & Dispatch</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Collection & Age Verification Modal */}
      {showAgeModal && (
        <CollectionAgeVerificationModal
          order={order}
          onVerified={() => {
            setHandoverVerified(true);
            setShowAgeModal(false);
          }}
          onClose={() => setShowAgeModal(false)}
        />
      )}
    </div>
  );
};
