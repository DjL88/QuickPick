/**
 * @file src/components/commerce/LiveOrderTrackerModal.tsx
 * Deliveroo & Uber Eats style real-time order tracking experience.
 * Connects directly to Deliverect Commerce API state and reflects live
 * picker progress from QuickPick and HeadsUp.
 */

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Bike,
  Package,
  Store,
  MapPin,
  ExternalLink,
  X,
  Phone,
  MessageSquare,
  ShieldCheck,
  ChevronRight,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  PenTool
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CollectionAgeVerificationModal } from './CollectionAgeVerificationModal.js';

interface LiveOrderTrackerModalProps {
  orderId: string;
  channelOrderDisplayId?: string;
  onClose: () => void;
  onSwitchToPicker?: (orderId: string) => void;
  onSwitchToHeadsUp?: () => void;
}

export const LiveOrderTrackerModal: React.FC<LiveOrderTrackerModalProps> = ({
  orderId,
  channelOrderDisplayId,
  onClose,
  onSwitchToPicker,
  onSwitchToHeadsUp,
}) => {
  const [trackData, setTrackData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAgeVerifyModal, setShowAgeVerifyModal] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  // Trigger celebration on initial placement
  useEffect(() => {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.6 },
    });
  }, []);

  // Poll order tracker status
  useEffect(() => {
    let isMounted = true;

    const fetchTrack = async () => {
      try {
        const res = await fetch(`/api/commerce/orders/${encodeURIComponent(orderId)}/track`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setTrackData(data);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to poll order tracking:', err);
      }
    };

    fetchTrack();
    const interval = setInterval(fetchTrack, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [orderId]);

  const stage = trackData?.stage || 'ORDER_PLACED';
  const progressPercent = trackData?.progressPercent || 20;

  const stages = [
    {
      key: 'ORDER_PLACED',
      label: 'Order Placed',
      desc: 'Sent via Deliverect Commerce API',
      isComplete: true,
      isCurrent: stage === 'ORDER_PLACED',
    },
    {
      key: 'PICKING',
      label: 'Store Picking',
      desc: trackData?.assignedPickerName
        ? `${trackData.assignedPickerName} is picking (${trackData.pickedItems}/${trackData.totalItems})`
        : 'Assigned to picker queue',
      isComplete: stage === 'PICKING' || stage === 'PACKED' || stage === 'DISPATCHED' || stage === 'DELIVERED',
      isCurrent: stage === 'PICKING',
    },
    {
      key: 'PACKED',
      label: 'Packed & Bagged',
      desc: 'Quality checked and sealed',
      isComplete: stage === 'PACKED' || stage === 'DISPATCHED' || stage === 'DELIVERED',
      isCurrent: stage === 'PACKED',
    },
    {
      key: 'DISPATCHED',
      label: 'On the Way',
      desc: 'Courier heading to your address',
      isComplete: stage === 'DISPATCHED' || stage === 'DELIVERED',
      isCurrent: stage === 'DISPATCHED',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden text-neutral-800 flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="bg-neutral-900 text-white p-5 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Live Deliverect Tracking
          </div>

          <h2 className="text-xl sm:text-2xl font-bold">{channelOrderDisplayId || `#ORD-${orderId.slice(-4).toUpperCase()}`}</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Estimated arrival in <span className="text-white font-semibold">20–30 minutes</span>
          </p>
        </div>

        {/* Scrollable Tracker Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Visual Simulated Map / Courier Radar */}
          <div className="relative h-36 rounded-xl bg-gradient-to-br from-emerald-950 via-neutral-900 to-slate-900 overflow-hidden border border-neutral-800 p-4 flex flex-col justify-between text-white shadow-inner">
            {/* Background grid lines */}
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px]" />

            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-neutral-400">Store</div>
                  <div className="text-xs font-bold truncate max-w-[140px]">
                    {trackData?.metadata?.storeName || 'David Victor Deli'}
                  </div>
                </div>
              </div>

              {/* Animated Connection */}
              <div className="flex-1 mx-3 flex items-center justify-center">
                <div className="w-full h-0.5 bg-neutral-700 relative overflow-hidden rounded-full">
                  <div className="absolute inset-y-0 left-0 bg-emerald-400 animate-[progress_2s_ease-in-out_infinite] w-1/3 rounded-full" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] text-neutral-400">Your Address</div>
                  <div className="text-xs font-bold truncate max-w-[120px]">
                    {trackData?.metadata?.deliveryAddress || '142 Oxford St'}
                  </div>
                </div>
              </div>
            </div>

            {/* Courier status badge in map */}
            <div className="relative z-10 flex items-center justify-between bg-black/40 backdrop-blur-xs p-2 rounded-lg border border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-neutral-950 flex items-center justify-center">
                  <Bike className="w-3.5 h-3.5" />
                </div>
                <span className="text-neutral-200">
                  {stage === 'PICKING'
                    ? 'In store picking queue'
                    : stage === 'PACKED'
                    ? 'Waiting for rider assignment'
                    : 'Rider assigned and en route'}
                </span>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono font-bold">LIVE SYNC</span>
            </div>
          </div>

          {/* Stepper Timeline */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Order Status Progression
            </h3>

            <div className="relative pl-6 space-y-5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
              {stages.map((st, i) => (
                <div key={st.key} className="relative">
                  {/* Indicator Dot */}
                  <div
                    className={`absolute -left-6 top-0.5 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center transition-all ${
                      st.isComplete
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : st.isCurrent
                        ? 'border-emerald-600 bg-white text-emerald-600 animate-pulse'
                        : 'border-neutral-300 bg-white text-transparent'
                    }`}
                  >
                    {st.isComplete && <CheckCircle2 className="w-3 h-3 stroke-[3]" />}
                  </div>

                  <div>
                    <h4 className={`text-sm font-bold leading-none ${st.isCurrent ? 'text-emerald-700' : 'text-neutral-900'}`}>
                      {st.label}
                    </h4>
                    <p className="text-xs text-neutral-500 mt-1">{st.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Collection Handover & Age Restriction Verification Card */}
          <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Collection Handover & ID Check
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    {trackData?.items?.some((i: any) => i.ageRestricted)
                      ? 'Contains Age-Restricted 18+ Items'
                      : 'Store Collection Order Verification'}
                  </p>
                </div>
              </div>

              {verificationResult?.verified ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30">
                  Pending Check
                </span>
              )}
            </div>

            {verificationResult?.verified ? (
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-neutral-300 space-y-1">
                <div className="text-emerald-400 font-bold flex items-center gap-1">
                  <UserCheck className="w-4 h-4" /> Collection Confirmed & ID Verified
                </div>
                {verificationResult.dob && <div>DOB Checked: {verificationResult.dob}</div>}
                {verificationResult.collectionCode && (
                  <div>Channel Code: <span className="font-mono font-bold text-amber-300">{verificationResult.collectionCode}</span></div>
                )}
                {verificationResult.signatureData && (
                  <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                    <PenTool className="w-3 h-3 text-emerald-400" /> On-screen customer signature captured
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAgeVerifyModal(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Verify ID (DOB / Photo) & Customer Sign</span>
              </button>
            )}
          </div>

          {/* Real-time Fulfillment Bridge Trigger (QuickPick Demo Feature) */}
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Deliverect Commerce & Picker Interlock</span>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed">
              This order is actively synchronized with the store fulfillment pipeline. You can switch to the Picker or HeadsUp view right now to pick these items live!
            </p>
            <div className="flex gap-2 pt-1">
              {onSwitchToPicker && (
                <button
                  type="button"
                  onClick={() => onSwitchToPicker(orderId)}
                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <Package className="w-3.5 h-3.5" />
                  Pick in QuickPick
                </button>
              )}
              {onSwitchToHeadsUp && (
                <button
                  type="button"
                  onClick={onSwitchToHeadsUp}
                  className="py-2 px-3 rounded-lg bg-white border border-emerald-300 hover:bg-emerald-100/50 text-emerald-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  HeadsUp Board
                </button>
              )}
            </div>
          </div>

          {/* Items Summary list */}
          {trackData?.items && trackData.items.length > 0 && (
            <div className="space-y-2 border-t border-neutral-100 pt-4">
              <h4 className="text-xs font-bold text-neutral-900">Items Ordered ({trackData.items.length})</h4>
              <div className="space-y-1.5 text-xs text-neutral-600 divide-y divide-neutral-100">
                {trackData.items.map((it: any) => (
                  <div key={it._id} className="pt-1.5 first:pt-0 flex items-center justify-between">
                    <span>
                      {it.quantity}x {it.name}
                    </span>
                    <span className="font-semibold text-neutral-900">
                      {it.status === 'PICKED' ? (
                        <span className="text-emerald-600 font-bold">✓ Picked</span>
                      ) : (
                        <span className="text-neutral-400">Queued</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500 shrink-0">
          <span>Need help with your order?</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-900 text-white font-bold hover:bg-neutral-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>

      {/* Collection & Age Verification Modal */}
      {showAgeVerifyModal && (
        <CollectionAgeVerificationModal
          order={trackData || { _id: orderId, channelOrderDisplayId, orderType: 'PICKUP', items: [] }}
          onVerified={(res) => {
            setVerificationResult(res);
            setShowAgeVerifyModal(false);
          }}
          onClose={() => setShowAgeVerifyModal(false)}
        />
      )}
    </div>
  );
};
