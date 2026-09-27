import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Package,
  Printer,
  Users,
  WifiOff,
} from 'lucide-react';
import { PickerUser, PickingOrder } from '@contracts/index.js';
import {
  classifyHeadsUpOrder,
  getHeadsUpDueState,
  getHeadsUpProgress,
  HeadsUpLane,
} from '../lib/headsup.js';

interface HeadsUpBoardProps {
  orders: PickingOrder[];
  activePickers: PickerUser[];
  isOnline: boolean;
  onOpenOrder: (order: PickingOrder) => void;
  onBack: () => void;
  onOpenPrinterSettings: () => void;
}

const laneMeta: Array<{ id: HeadsUpLane; title: string; description: string }> = [
  { id: 'NEW', title: 'New', description: 'Waiting to start' },
  { id: 'PICKING', title: 'Picking', description: 'Active on floor' },
  { id: 'WAITING_APPROVAL', title: 'Waiting / Approval', description: 'Customer or exception decision' },
  { id: 'READY', title: 'Ready', description: 'Picked and ready to hand over' },
  { id: 'EXCEPTIONS', title: 'Exceptions', description: 'Needs attention' },
];

const laneClasses: Record<HeadsUpLane, string> = {
  NEW: 'border-sky-200 bg-sky-50/40',
  PICKING: 'border-emerald-200 bg-emerald-50/40',
  WAITING_APPROVAL: 'border-amber-200 bg-amber-50/50',
  READY: 'border-violet-200 bg-violet-50/40',
  EXCEPTIONS: 'border-rose-200 bg-rose-50/50',
};

const dueClasses: Record<string, string> = {
  OK: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  WARNING: 'bg-amber-50 text-amber-900 border-amber-200',
  CRITICAL: 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse',
  OVERDUE: 'bg-rose-600 text-white border-rose-700 animate-pulse',
  UNKNOWN: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

const channelName = (order: PickingOrder) =>
  String(order.metadata?.channelName ?? order.metadata?.channel ?? order.metadata?.source ?? 'Demo');

const collaboratorsFor = (order: PickingOrder) => {
  const raw = order.metadata?.collaboratorNames;
  return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string') : [];
};

export const HeadsUpBoard: React.FC<HeadsUpBoardProps> = ({
  orders,
  activePickers,
  isOnline,
  onOpenOrder,
  onBack,
  onOpenPrinterSettings,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const lanes = useMemo(() => {
    const map = new Map<HeadsUpLane, PickingOrder[]>(laneMeta.map((lane) => [lane.id, []]));
    for (const order of orders) map.get(classifyHeadsUpOrder(order))?.push(order);
    for (const lane of laneMeta) {
      map.get(lane.id)?.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
    }
    return map;
  }, [orders]);

  const exceptionCount = lanes.get('EXCEPTIONS')?.length ?? 0;
  const criticalCount = orders.filter((order) => {
    const level = getHeadsUpDueState(order, nowMs).level;
    return level === 'CRITICAL' || level === 'OVERDUE';
  }).length;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4" aria-label="QuickPick HeadsUp board">
      <header className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-700"
            aria-label="Back to pick queue"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-neutral-950">HeadsUp</h1>
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
                Kitchen display
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              Live floor view for packing desks, tablets and desktop touchscreens.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3">
            <Users className="h-4 w-4 text-neutral-500" />
            <span className="font-semibold text-neutral-800">{activePickers.length}</span>
            <span className="text-neutral-500">active</span>
          </div>
          {!isOnline && (
            <div className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-amber-900">
              <WifiOff className="h-4 w-4" />
              Offline
            </div>
          )}
          <button
            type="button"
            onClick={onOpenPrinterSettings}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 font-semibold text-neutral-700 shadow-sm"
          >
            <Printer className="h-4 w-4" />
            Printers
          </button>
        </div>
      </header>

      {(criticalCount > 0 || exceptionCount > 0) && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
          role="status"
          aria-live="polite"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
          <strong>Heads up:</strong>
          {criticalCount > 0 && <span>{criticalCount} order{criticalCount === 1 ? '' : 's'} at SLA risk.</span>}
          {exceptionCount > 0 && <span>{exceptionCount} exception{exceptionCount === 1 ? '' : 's'} need attention.</span>}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-flow-col auto-cols-[minmax(280px,1fr)] gap-3 overflow-x-auto pb-2 xl:grid-flow-row xl:grid-cols-5">
        {laneMeta.map((lane) => {
          const laneOrders = lanes.get(lane.id) ?? [];
          return (
            <section
              key={lane.id}
              className={`min-h-[520px] rounded-2xl border p-3 ${laneClasses[lane.id]}`}
              aria-label={lane.title}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-neutral-950">{lane.title}</h2>
                  <p className="text-[11px] text-neutral-500">{lane.description}</p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 font-mono text-xs font-bold text-neutral-700 shadow-sm">
                  {laneOrders.length}
                </span>
              </div>

              <div className="space-y-2">
                {laneOrders.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-300 bg-white/70 p-5 text-center text-xs text-neutral-400">
                    Nothing here
                  </div>
                ) : (
                  laneOrders.map((order) => {
                    const progress = getHeadsUpProgress(order);
                    const due = getHeadsUpDueState(order, nowMs);
                    const collaborators = collaboratorsFor(order);
                    const groupCount = order.groups?.length ?? 0;
                    const percent = progress.total ? Math.round((progress.handled / progress.total) * 100) : 0;

                    return (
                      <article key={order._id} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-neutral-700">
                                {order.channelOrderDisplayId}
                              </span>
                              <span className="truncate text-[11px] font-semibold text-neutral-500">
                                {channelName(order)}
                              </span>
                            </div>
                            <h3 className="mt-1 truncate text-sm font-bold text-neutral-950">{order.customer.name}</h3>
                          </div>
                          <span className={`shrink-0 rounded-lg border px-2 py-1 font-mono text-[11px] font-bold ${dueClasses[due.level]}`}>
                            {due.label}
                          </span>
                        </div>

                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-neutral-600">{progress.handled}/{progress.total} handled</span>
                            <span className="font-mono text-neutral-400">{percent}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                            <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${percent}%` }} />
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                          {progress.pendingSubstitutions > 0 && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                              {progress.pendingSubstitutions} approval
                            </span>
                          )}
                          {progress.replaced > 0 && (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-sky-800">
                              {progress.replaced} substitute
                            </span>
                          )}
                          {progress.removed > 0 && (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-rose-800">
                              {progress.removed} missing
                            </span>
                          )}
                          {groupCount > 0 && (
                            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-violet-800">
                              {groupCount} group{groupCount === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>

                        <div className="mt-3 space-y-1 text-[11px] text-neutral-500">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            <span className="truncate">
                              {order.assignedPickerName || 'Unassigned'}
                              {collaborators.length > 0 ? ` + ${collaborators.length} collaborator${collaborators.length === 1 ? '' : 's'}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{order.orderType || 'DELIVERY'}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenOrder(order)}
                          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-3 text-sm font-bold text-white transition active:scale-[0.99]"
                        >
                          {lane.id === 'READY' ? <CheckCircle2 className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                          {lane.id === 'NEW' ? 'Start pick' : lane.id === 'READY' ? 'View order' : 'Open order'}
                        </button>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
};
