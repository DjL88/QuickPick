/**
 * @file src/components/HeadsUpDisplay.tsx
 * QP-05 HeadsUp KDS Board & Packing Supervisor Display for QuickPick.
 * - 5-column board: New | Picking | Waiting / Approval | Ready | Exceptions
 * - Live SLA countdowns and handled/total progress indicators
 * - Bundle & group indicators without fabricating metadata
 * - Integrated print triggers (Receipt, Tote Label, Bag Label) via MockPrinterProvider
 * - Live SSE subscription and audio alerts
 * - Touch-friendly tablet & widescreen layouts
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Printer,
  Bike,
  User,
  Package,
  ArrowRight,
  WifiOff,
  ShoppingBag,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  X,
  FileText,
  Tag,
} from 'lucide-react';
import { PickingOrder, PickingItem, PrintJob } from '@contracts/index.js';
import { sounds } from '../lib/audio.js';
import {
  mockPrinter,
  printOrderReceipt,
  printToteLabel,
  printBagLabels,
} from '../../packages/printer/src/index.js';

interface HeadsUpDisplayProps {
  onBackToPicker?: () => void;
  onSelectOrderToPick?: (orderId: string) => void;
  storeId?: string;
  storeName?: string;
}

export const HeadsUpDisplay: React.FC<HeadsUpDisplayProps> = ({
  onBackToPicker,
  onSelectOrderToPick,
  storeId = 'loc_london_flagship',
  storeName = 'Flagship Store',
}) => {
  const [orders, setOrders] = useState<PickingOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [recentPrintJobs, setRecentPrintJobs] = useState<PrintJob[]>([]);
  const [showPrintModal, setShowPrintModal] = useState<PickingOrder | null>(null);
  const [printSuccessMsg, setPrintSuccessMsg] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Fetch orders from backend
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?location=${encodeURIComponent(storeId)}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.warn('Failed to fetch orders in HeadsUp:', err);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  // Initial fetch and polling
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 4000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // SSE Live Events Listener
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/events');
      es.addEventListener('order:created', () => {
        sounds.playNewOrderAlert();
        fetchOrders();
      });
      es.addEventListener('order:updated', () => {
        fetchOrders();
      });
    } catch {}

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      es?.close();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchOrders]);

  // Load recent print jobs
  const refreshPrintJobs = useCallback(async () => {
    const jobs = await mockPrinter.getRecentJobs();
    setRecentPrintJobs(jobs);
  }, []);

  useEffect(() => {
    refreshPrintJobs();
  }, [refreshPrintJobs]);

  // Five columns categorization
  const columns = useMemo(() => {
    const colNew: PickingOrder[] = [];
    const colPicking: PickingOrder[] = [];
    const colWaitingApproval: PickingOrder[] = [];
    const colReady: PickingOrder[] = [];
    const colExceptions: PickingOrder[] = [];

    orders.forEach((ord) => {
      const hasReplacements = ord.items.some((i) => i.status === 'REPLACED');
      const hasRemovals = ord.items.some((i) => i.status === 'REMOVED');
      const isCancelled = ord.status === 'CANCELLED' || ord.pickerStatus === 'REJECTED';
      const isCompleted = ord.status === 'FINALIZED' || ord.pickerStatus === 'COMPLETED';

      if (isCancelled || hasRemovals) {
        colExceptions.push(ord);
      } else if (isCompleted) {
        colReady.push(ord);
      } else if (hasReplacements) {
        colWaitingApproval.push(ord);
      } else if (ord.pickerStatus === 'IN_PROGRESS') {
        colPicking.push(ord);
      } else {
        colNew.push(ord);
      }
    });

    return {
      new: colNew,
      picking: colPicking,
      waiting: colWaitingApproval,
      ready: colReady,
      exceptions: colExceptions,
    };
  }, [orders]);

  // Handle Quick Print actions
  const handlePrintReceipt = async (order: PickingOrder) => {
    const res = await printOrderReceipt(order);
    if (res.success) {
      sounds.playPickSuccess();
      setPrintSuccessMsg(`Receipt printed for ${order.channelOrderDisplayId}`);
      setTimeout(() => setPrintSuccessMsg(null), 3000);
      refreshPrintJobs();
    }
  };

  const handlePrintTote = async (order: PickingOrder) => {
    const res = await printToteLabel(order);
    if (res.success) {
      sounds.playPickSuccess();
      setPrintSuccessMsg(`Tote label printed for ${order.channelOrderDisplayId}`);
      setTimeout(() => setPrintSuccessMsg(null), 3000);
      refreshPrintJobs();
    }
  };

  const handlePrintBags = async (order: PickingOrder, bagCount: number = 2) => {
    const res = await printBagLabels(order, bagCount);
    if (res.length > 0) {
      sounds.playPickSuccess();
      setPrintSuccessMsg(`${res.length} bag labels printed for ${order.channelOrderDisplayId}`);
      setTimeout(() => setPrintSuccessMsg(null), 3000);
      refreshPrintJobs();
    }
  };

  const handleStartPickFromBoard = async (order: PickingOrder) => {
    if (order.pickerStatus === 'IN_PROGRESS') {
      onSelectOrderToPick?.(order._id);
      return;
    }

    try {
      await fetch(`/api/orders/${encodeURIComponent(order._id)}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickerId: 'lead_kds',
          pickerName: 'KDS Supervisor',
        }),
      });
      fetchOrders();
      onSelectOrderToPick?.(order._id);
    } catch {
      onSelectOrderToPick?.(order._id);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b2026] text-neutral-100 flex flex-col font-sans selection:bg-white selection:text-[var(--ltx-brand)]">
      {/* 1. TOP KDS HEADSUP BAR */}
      <header className="sticky top-0 z-40 bg-[var(--ltx-brand-strong)] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBackToPicker && (
            <button
              onClick={onBackToPicker}
              className="min-h-[40px] px-3 rounded-xl bg-white/8 hover:bg-white/12 text-white/75 text-xs font-medium flex items-center gap-1.5 transition active:scale-[0.98]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Mobile Picker</span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden border border-white/15 bg-white/5">
              <img src="/icon.svg" alt="LTx" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="ltx-display text-base font-semibold text-white">
                  HeadsUp
                </h1>
                <span className="text-[10px] px-2 py-1 rounded-lg bg-white/8 text-white/55">
                  {storeName}
                </span>
              </div>
              <div className="text-[10px] text-white/45 mt-0.5">QuickPick by LTx</div>
            </div>
          </div>
        </div>

        {/* Global Status & Quick Tools */}
        <div className="flex items-center gap-2">
          {!isOnline && (
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-950/80 text-amber-300 border border-amber-800 text-xs font-medium">
              <WifiOff className="w-3.5 h-3.5" />
              <span>Offline Mode</span>
            </div>
          )}

          <button
            onClick={fetchOrders}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
            title="Refresh Board"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. PRINT SUCCESS TOAST */}
      {printSuccessMsg && (
        <div className="fixed top-16 inset-x-0 z-50 flex justify-center pointer-events-none px-4 animate-in slide-in-from-top duration-200">
          <div className="px-3.5 py-2 rounded-lg bg-emerald-900 border border-emerald-700 text-emerald-100 text-xs font-medium flex items-center gap-2 shadow-lg">
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>{printSuccessMsg}</span>
          </div>
        </div>
      )}

      {/* 3. FIVE-COLUMN KDS BOARD */}
      <main className="flex-1 p-3 overflow-x-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 min-w-[320px] lg:min-w-[1200px] h-full">
          {/* COLUMN 1: NEW ORDERS */}
          <ColumnCardList
            title="New"
            count={columns.new.length}
            badgeColor="bg-white/8 text-white/60 border-white/10"
            orders={columns.new}
            onAction={handleStartPickFromBoard}
            actionLabel="Start Pick"
            onOpenPrint={(ord) => setShowPrintModal(ord)}
          />

          {/* COLUMN 2: PICKING */}
          <ColumnCardList
            title="Picking"
            count={columns.picking.length}
            badgeColor="bg-white/8 text-white/60 border-white/10"
            orders={columns.picking}
            onAction={handleStartPickFromBoard}
            actionLabel="Resume Pick"
            onOpenPrint={(ord) => setShowPrintModal(ord)}
          />

          {/* COLUMN 3: WAITING / APPROVAL */}
          <ColumnCardList
            title="Approval"
            count={columns.waiting.length}
            badgeColor="bg-amber-300/10 text-amber-200 border-amber-200/15"
            orders={columns.waiting}
            onAction={handleStartPickFromBoard}
            actionLabel="Review"
            onOpenPrint={(ord) => setShowPrintModal(ord)}
          />

          {/* COLUMN 4: READY / PACKED */}
          <ColumnCardList
            title="Ready"
            count={columns.ready.length}
            badgeColor="bg-white/8 text-white/60 border-white/10"
            orders={columns.ready}
            onAction={(ord) => handlePrintReceipt(ord)}
            actionLabel="Print Receipt"
            onOpenPrint={(ord) => setShowPrintModal(ord)}
          />

          {/* COLUMN 5: EXCEPTIONS */}
          <ColumnCardList
            title="Exceptions"
            count={columns.exceptions.length}
            badgeColor="bg-rose-300/10 text-rose-200 border-rose-200/15"
            orders={columns.exceptions}
            onAction={handleStartPickFromBoard}
            actionLabel="Inspect"
            onOpenPrint={(ord) => setShowPrintModal(ord)}
          />
        </div>
      </main>

      {/* 4. MODAL: QUICK PRINTER DIALOG */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">
                  Print Labels & Receipt · {showPrintModal.channelOrderDisplayId}
                </h3>
              </div>
              <button
                onClick={() => setShowPrintModal(null)}
                className="p-1 text-neutral-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-neutral-300">
              <p>
                Customer: <strong className="text-white">{showPrintModal.customer.name}</strong> ({showPrintModal.items.length} items)
              </p>

              <div className="grid grid-cols-3 gap-2 pt-2">
                <button
                  onClick={() => {
                    handlePrintReceipt(showPrintModal);
                    setShowPrintModal(null);
                  }}
                  className="p-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex flex-col items-center gap-1.5 text-center transition active:scale-[0.98]"
                >
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <span className="font-semibold text-white">Receipt</span>
                  <span className="text-[10px] text-neutral-400">Full items itemized</span>
                </button>

                <button
                  onClick={() => {
                    handlePrintTote(showPrintModal);
                    setShowPrintModal(null);
                  }}
                  className="p-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex flex-col items-center gap-1.5 text-center transition active:scale-[0.98]"
                >
                  <Tag className="w-5 h-5 text-amber-400" />
                  <span className="font-semibold text-white">Tote Label</span>
                  <span className="text-[10px] text-neutral-400">Barcode & Cart</span>
                </button>

                <button
                  onClick={() => {
                    handlePrintBags(showPrintModal, 2);
                    setShowPrintModal(null);
                  }}
                  className="p-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex flex-col items-center gap-1.5 text-center transition active:scale-[0.98]"
                >
                  <ShoppingBag className="w-5 h-5 text-emerald-400" />
                  <span className="font-semibold text-white">Bag Labels</span>
                  <span className="text-[10px] text-neutral-400">Bag 1 of 2</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800 flex justify-end">
              <button
                onClick={() => setShowPrintModal(null)}
                className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// SUBCOMPONENT: Column Card List
// -------------------------------------------------------------
interface ColumnCardListProps {
  title: string;
  count: number;
  badgeColor: string;
  orders: PickingOrder[];
  onAction: (order: PickingOrder) => void;
  actionLabel: string;
  onOpenPrint: (order: PickingOrder) => void;
}

const ColumnCardList: React.FC<ColumnCardListProps> = ({
  title,
  count,
  badgeColor,
  orders,
  onAction,
  actionLabel,
  onOpenPrint,
}) => {
  return (
    <div className="flex flex-col bg-[#102a31] border border-white/8 rounded-2xl overflow-hidden h-full">
      {/* Column Header */}
      <div className="p-3 border-b border-white/8 flex items-center justify-between bg-white/[0.025] shrink-0">
        <span className="ltx-display text-sm font-semibold text-white/90">{title}</span>
        <span className={`text-[11px] font-mono px-2 py-0.2 rounded-full border font-semibold ${badgeColor}`}>
          {count}
        </span>
      </div>

      {/* Orders List Container */}
      <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-120px)]">
        {orders.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-500">
            No orders
          </div>
        ) : (
          orders.map((order) => {
            const pickableItems = order.items.filter((i) => !i.isTextInstruction);
            const pickedItems = pickableItems.filter((i) => i.status === 'PICKED');
            const progressPercent = pickableItems.length > 0
              ? Math.round((pickedItems.length / pickableItems.length) * 100)
              : 0;

            const minutesLeft = (order as any).minutesRemaining ?? 20;
            const isUrgent = order.slaStatus === 'CRITICAL' || order.slaStatus === 'OVERDUE';
            const bundleCount = order.groups?.length || 0;

            return (
              <div
                key={order._id}
                className={`p-3 rounded-xl border bg-[#15333b] transition flex flex-col justify-between gap-2 hover:bg-[#173943] ${
                  isUrgent ? 'border-rose-900/80' : 'border-neutral-800'
                }`}
              >
                {/* Header: ID + Customer + SLA */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono font-semibold text-white bg-neutral-800 px-1.5 py-0.5 rounded">
                      {order.channelOrderDisplayId}
                    </span>
                    <div className="flex items-center gap-1 text-[11px] font-medium text-neutral-400">
                      <Clock className="w-3 h-3 text-neutral-500" />
                      <span className={isUrgent ? 'text-rose-400 font-bold' : ''}>
                        {minutesLeft < 0 ? `${Math.abs(minutesLeft)}m overdue` : `${minutesLeft}m left`}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-neutral-200 truncate">
                    {order.customer.name}
                  </div>

                  {/* Metadata tags: Assigned picker, bundles, collaborators */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[10px] text-neutral-400 font-mono">
                    {order.assignedPickerName && (
                      <span className="flex items-center gap-0.5 text-emerald-400 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-900">
                        <User className="w-2.5 h-2.5" />
                        {order.assignedPickerName}
                      </span>
                    )}

                    {bundleCount > 0 && (
                      <span className="flex items-center gap-0.5 text-indigo-300 bg-indigo-950/40 px-1.5 py-0.2 rounded border border-indigo-900">
                        <Layers className="w-2.5 h-2.5" />
                        {bundleCount} bundle
                      </span>
                    )}

                    {typeof order.collaboratorCount === 'number' && order.collaboratorCount > 1 && (
                      <span className="text-neutral-400 bg-neutral-800 px-1.5 py-0.2 rounded">
                        👥 {order.collaboratorCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Progress</span>
                    <span className="font-mono">
                      {pickedItems.length}/{pickableItems.length} ({progressPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80">
                  <button
                    type="button"
                    onClick={() => onOpenPrint(order)}
                    className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
                    title="Print Options"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onAction(order)}
                    className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs flex items-center gap-1 transition active:scale-[0.98]"
                  >
                    <span>{actionLabel}</span>
                    <ChevronRight className="w-3 h-3 text-neutral-400" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
