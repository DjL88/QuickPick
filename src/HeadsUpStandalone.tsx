import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PickerUser, PickingOrder } from '@contracts/index.js';
import { HeadsUpBoard } from './components/HeadsUpBoard.js';
import { PrinterSettingsPanel } from './components/PrinterSettingsPanel.js';
import { demoPrinterProvider } from './lib/printers.js';
import { sounds } from './lib/audio.js';
import { useOnlineStatus } from './hooks/useOnlineStatus.js';

export default function HeadsUpStandalone() {
  const isOnline = useOnlineStatus();
  const [orders, setOrders] = useState<PickingOrder[]>([]);
  const [activePickers, setActivePickers] = useState<PickerUser[]>([]);
  const [showPrinterSettings, setShowPrinterSettings] = useState(false);
  const [focusedOrder, setFocusedOrder] = useState<PickingOrder | null>(null);
  const location = new URLSearchParams(window.location.search).get('location');

  const fetchOrders = useCallback(async () => {
    const query = location ? `?location=${encodeURIComponent(location)}` : '';
    try {
      const response = await fetch(`/api/orders${query}`);
      if (!response.ok) return;
      const data = await response.json();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setFocusedOrder((current) => {
        if (!current) return null;
        return (Array.isArray(data.orders) ? data.orders : []).find((order: PickingOrder) => order._id === current._id) || null;
      });
    } catch {}
  }, [location]);

  const fetchTeam = useCallback(async () => {
    try {
      const response = await fetch('/api/picker/team');
      if (!response.ok) return;
      const data = await response.json();
      setActivePickers(Array.isArray(data.activePickers) ? data.activePickers : []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchTeam();
    const interval = window.setInterval(() => {
      fetchOrders();
      fetchTeam();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [fetchOrders, fetchTeam]);

  useEffect(() => {
    const events = new EventSource('/api/events');
    events.addEventListener('order:created', () => {
      sounds.playNewOrderAlert();
      fetchOrders();
    });
    events.addEventListener('order:updated', fetchOrders);
    events.addEventListener('picker:presence', (event) => {
      try {
        const list = JSON.parse((event as MessageEvent).data);
        if (Array.isArray(list)) setActivePickers(list);
      } catch {}
    });
    return () => events.close();
  }, [fetchOrders]);

  const openOrder = async (order: PickingOrder) => {
    if (order.pickerStatus === 'NOT_STARTED') {
      try {
        await fetch(`/api/orders/${encodeURIComponent(order._id)}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pickerId: 'headsup', pickerName: 'HeadsUp station' }),
        });
        await fetchOrders();
      } catch {}
    }
    setFocusedOrder(order);
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-3 text-neutral-900 md:p-4 xl:p-5">
      <HeadsUpBoard
        orders={orders}
        activePickers={activePickers}
        isOnline={isOnline}
        onOpenOrder={openOrder}
        onBack={() => window.location.assign('/')}
        onOpenPrinterSettings={() => setShowPrinterSettings(true)}
      />

      {focusedOrder && (
        <div className="fixed inset-0 z-[65] flex justify-end bg-neutral-950/40 backdrop-blur-sm">
          <aside className="h-full w-full max-w-md overflow-y-auto border-l border-neutral-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xs font-bold text-neutral-500">{focusedOrder.channelOrderDisplayId}</div>
                <h2 className="mt-1 text-lg font-bold text-neutral-950">{focusedOrder.customer.name}</h2>
                <p className="text-xs text-neutral-500">{focusedOrder.assignedPickerName || 'Unassigned'} · {focusedOrder.items.length} lines</p>
              </div>
              <button
                type="button"
                onClick={() => setFocusedOrder(null)}
                className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50"
                aria-label="Close order details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {focusedOrder.items.map((item) => (
                <div key={item._id} className="rounded-xl border border-neutral-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-neutral-900">{item.name}</div>
                      <div className="mt-1 text-[11px] text-neutral-500">
                        {item.aisle || 'Location not set'} · {item.shelf || 'Bay not set'}
                      </div>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold text-neutral-600">
                      {item.status}
                    </span>
                  </div>
                  {item.substitutionState === 'PENDING_CUSTOMER' && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-900">
                      Waiting for substitution approval
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="mt-4 min-h-12 w-full rounded-xl bg-neutral-950 px-4 text-sm font-bold text-white"
            >
              Open picker
            </button>
          </aside>
        </div>
      )}

      {showPrinterSettings && (
        <PrinterSettingsPanel provider={demoPrinterProvider} onClose={() => setShowPrinterSettings(false)} />
      )}
    </div>
  );
}
