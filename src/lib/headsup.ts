import { PickingOrder } from '@contracts/index.js';

export type HeadsUpLane = 'NEW' | 'PICKING' | 'WAITING_APPROVAL' | 'READY' | 'EXCEPTIONS';

export interface HeadsUpProgress {
  handled: number;
  total: number;
  picked: number;
  replaced: number;
  removed: number;
  pendingSubstitutions: number;
  failedSync: number;
}

export interface HeadsUpDueState {
  minutes: number | null;
  label: string;
  level: 'OK' | 'WARNING' | 'CRITICAL' | 'OVERDUE' | 'UNKNOWN';
}

export function getHeadsUpProgress(order: PickingOrder): HeadsUpProgress {
  const items = order.items || [];
  return {
    total: items.length,
    handled: items.filter((item) => item.status !== 'PENDING').length,
    picked: items.filter((item) => item.status === 'PICKED').length,
    replaced: items.filter((item) => item.status === 'REPLACED').length,
    removed: items.filter((item) => item.status === 'REMOVED').length,
    pendingSubstitutions: items.filter((item) => item.substitutionState === 'PENDING_CUSTOMER').length,
    failedSync: items.filter((item) => item.syncState === 'FAILED').length,
  };
}

export function classifyHeadsUpOrder(order: PickingOrder): HeadsUpLane {
  const progress = getHeadsUpProgress(order);
  const lifecycleFailure =
    order.metadata?.lastLifecycleEvent === 'PARTNER_UPDATE_FAILED' ||
    order.metadata?.integrationState === 'FAILED';

  if (
    order.pickerStatus === 'REJECTED' ||
    order.status === 'CANCELLED' ||
    progress.failedSync > 0 ||
    lifecycleFailure
  ) {
    return 'EXCEPTIONS';
  }

  if (progress.pendingSubstitutions > 0) return 'WAITING_APPROVAL';
  if (order.pickerStatus === 'COMPLETED' || order.status === 'FINALIZED') return 'READY';
  if (order.pickerStatus === 'IN_PROGRESS') return 'PICKING';
  return 'NEW';
}

export function getHeadsUpDueState(order: PickingOrder, nowMs = Date.now()): HeadsUpDueState {
  const dueMs = Date.parse(order.dueAt);
  if (!Number.isFinite(dueMs)) {
    return { minutes: null, label: 'No due time', level: 'UNKNOWN' };
  }

  const minutes = Math.ceil((dueMs - nowMs) / 60_000);
  if (minutes < 0) return { minutes, label: `${Math.abs(minutes)}m overdue`, level: 'OVERDUE' };
  if (minutes <= 5) return { minutes, label: `${minutes}m left`, level: 'CRITICAL' };
  if (minutes <= 15) return { minutes, label: `${minutes}m left`, level: 'WARNING' };
  return { minutes, label: `${minutes}m left`, level: 'OK' };
}
