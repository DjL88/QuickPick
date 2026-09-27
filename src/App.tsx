/**
 * @file src/App.tsx
 * LTx Picker - Fun, high-performance standalone picking app compatible with
 * Deliverect Generic Picking API, powered by Altie AI route planning and barcode/photo scanning.
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Camera,
  Sparkles,
  QrCode,
  Flame,
  ChevronRight,
  RotateCcw,
  History,
  Bike,
  Check,
  X,
  Search,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  ShoppingBag,
  MapPin,
  Scale,
  ListOrdered,
  Layers,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  UserCheck,
  Smartphone,
  LayoutDashboard
} from 'lucide-react';
import {
  PickingOrder,
  PickingItem,
  PickingGroup,
  PickerUser,
  StoreLocation,
  RemovalReason,
  UpdateOrderItemAction,
  AuditLogEntry,
  getPickAllBlockReasons,
  getPickAllBlockReasonsForLine
} from '@contracts/index.js';
import { sounds } from './lib/audio.js';
import { offlineQueue } from './lib/offlineQueue.js';
import { useOnlineStatus } from './hooks/useOnlineStatus.js';
import { useHardwareScanner, normalizeBarcode, matchesBarcode } from './hooks/useHardwareScanner.js';
import { PWAInstallButton } from './components/PWAInstallButton.js';
import { CameraBarcodeScanner } from './components/CameraBarcodeScanner.js';
import { PhotoRecognitionModal } from './components/PhotoRecognitionModal.js';
import { SwipeCardPicker } from './components/SwipeCardPicker.js';
import { OrderGroupRail } from './components/OrderGroupRail.js';
import { HeadsUpDisplay } from './components/HeadsUpDisplay.js';
import { WeightEntryModal } from './components/WeightEntryModal.js';
import { SubstitutionModal } from './components/SubstitutionModal.js';
import { CourierModal } from './components/CourierModal.js';
import { OrderSummaryModal } from './components/OrderSummaryModal.js';
import { AuditTrailDrawer } from './components/AuditTrailDrawer.js';
import { SimulatorDrawer } from './components/SimulatorDrawer.js';
import { TeamPresenceBar } from './components/TeamPresenceBar.js';
import { DavidVictorModal } from './components/DavidVictorModal.js';
import { ConsumerOrderingApp } from './components/commerce/ConsumerOrderingApp.js';
import { buildGroupPickAllPlan } from './lib/pickAllGuard.js';
import { HoldToConfirmButton } from './components/HoldToConfirmButton.js';

export default function App() {
  const isOnline = useOnlineStatus();

  // App Navigation & Selected State
  const [currentView, setCurrentView] = useState<'ordering' | 'queue' | 'picking' | 'headsup'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/headsup')) return 'headsup';
      if (window.location.pathname.startsWith('/picker')) return 'queue';
    }
    return 'ordering';
  });
  const [pickMode, setPickMode] = useState<'swipe' | 'list'>('swipe');
  const [queueTab, setQueueTab] = useState<'ALL' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');

  // Handle URL path changes
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname.startsWith('/headsup')) {
        setCurrentView('headsup');
      } else if (window.location.pathname.startsWith('/picker')) {
        setCurrentView('queue');
      } else if (currentView === 'headsup') {
        setCurrentView('ordering');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentView]);

  // Stores & Current Picker
  const [currentUser, setCurrentUser] = useState<PickerUser>({
    id: 'picker_alex',
    name: 'Alex Turner',
    role: 'picker',
    storeId: 'loc_london_flagship',
    storeName: 'LTx Retail - London Flagship',
    currentAisle: 'Aisle 1',
  });

  const [stores, setStores] = useState<StoreLocation[]>([
    {
      id: 'loc_london_flagship',
      name: 'LTx Retail - London Flagship',
      address: '142 Oxford St, London W1D 1LU',
      hmacSecret: 'loc_london_flagship',
    },
    {
      id: 'loc_manchester_hub',
      name: 'LTx Retail - Manchester Hub',
      address: '88 Deansgate, Manchester M3 2ER',
      hmacSecret: 'loc_manchester_hub',
    },
    {
      id: 'loc_edinburgh_express',
      name: 'LTx Retail - Edinburgh Express',
      address: '24 Princes St, Edinburgh EH2 2AN',
      hmacSecret: 'loc_edinburgh_express',
    },
  ]);

  const [activeTeam, setActiveTeam] = useState<PickerUser[]>([
    { id: 'picker_alex', name: 'Alex Turner', role: 'picker', storeId: 'loc_london_flagship', storeName: 'London Flagship', currentAisle: 'Aisle 1' },
    { id: 'picker_sam', name: 'Sam Rivera', role: 'picker', storeId: 'loc_london_flagship', storeName: 'London Flagship', currentAisle: 'Aisle 5 - Chilled' },
    { id: 'picker_priya', name: 'Priya Patel', role: 'lead', storeId: 'loc_london_flagship', storeName: 'London Flagship', currentAisle: 'Aisle 8 - Frozen' },
  ]);

  // Orders State
  const [orders, setOrders] = useState<PickingOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [lastLocalUnitUndo, setLastLocalUnitUndo] = useState<{
    orderId: string;
    itemId: string;
    previousPickedQuantity: number;
    expectedPickedQuantity: number;
  } | null>(null);

  // Modals & Drawers
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState<PickingItem | null>(null);
  const [showSubModal, setShowSubModal] = useState<PickingItem | null>(null);
  const [showCouriersModal, setShowCouriersModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [showSimulatorDrawer, setShowSimulatorDrawer] = useState(false);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [showDavidVictorModal, setShowDavidVictorModal] = useState(false);
  const [androidFrameMode, setAndroidFrameMode] = useState(false);

  // Notifications toast
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Fetch orders from API
  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?location=${encodeURIComponent(currentUser.storeId)}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.warn('Failed to fetch orders:', err);
    }
  }, [currentUser.storeId]);

  // Initial fetch and polling
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 3500);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Server-Sent Events (SSE) listener for real-time order arrival & sync
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/events');
      es.addEventListener('order:created', (e) => {
        sounds.playNewOrderAlert();
        showToast('🔔 New retail grocery order arrived from Deliverect!', 'info');
        fetchOrders();
      });
      es.addEventListener('order:updated', () => {
        fetchOrders();
      });
      es.addEventListener('picker:presence', (e) => {
        try {
          const list = JSON.parse(e.data);
          setActiveTeam(list);
        } catch {}
      });
    } catch {}

    return () => {
      es?.close();
    };
  }, [fetchOrders]);

  // Background offline queue sync
  useEffect(() => {
    if (isOnline) {
      offlineQueue.flush((synced) => {
        showToast(`Offline changes synchronized to Deliverect!`, 'success');
        fetchOrders();
      });
    }
  }, [isOnline, fetchOrders]);

  // Selected active order
  const activeOrder = useMemo(() => {
    return orders.find((o) => o._id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Handle Laser Hardware Scanner input
  const handleBarcodeScanned = useCallback(
    (code: string) => {
      if (!activeOrder || currentView !== 'picking') return;

      const cleanScan = normalizeBarcode(code);
      const pendingItems = activeOrder.items.filter((i) => i.status === 'PENDING');

      // Find matching item by PLU or GTIN
      const match = pendingItems.find((item) => {
        if (matchesBarcode(item.plu, cleanScan)) return true;
        if (item.gtin && item.gtin.some((g) => matchesBarcode(g, cleanScan))) return true;
        return false;
      });

      if (match) {
        sounds.playScanBeep();
        if (match.isWeight) {
          setShowWeightModal(match);
        } else {
          handleDirectPick(match);
        }
      } else {
        sounds.playErrorBuzz();
        showToast(`Barcode ${code} not matched to pending items in this order`, 'error');
      }
    },
    [activeOrder, currentView]
  );

  useHardwareScanner(handleBarcodeScanned, currentView === 'picking');

  // Start Picking order
  const handleStartOrder = async (order: PickingOrder) => {
    setSelectedOrderId(order._id);
    setCurrentView('picking');
    sounds.playScanBeep();

    try {
      await fetch(`/api/orders/${encodeURIComponent(order._id)}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickerId: currentUser.id,
          pickerName: currentUser.name,
        }),
      });
      fetchOrders();
    } catch {}
  };

  // Direct Pick Item (Multi-Quantity Step-by-Step Declaration)
  const handleDirectPick = async (item: PickingItem, weight?: number, pickAll: boolean = false) => {
    if (!activeOrder) return;

    const totalQty = item.quantity || 1;
    const currentPicked = item.pickedQuantity || 0;
    const nextPicked = pickAll ? totalQty : currentPicked + 1;
    const isCompleted = nextPicked >= totalQty;

    if (!isCompleted) {
      // Intermediate unit declaration! (Step N of Total)
      sounds.playUnitScanStep(nextPicked, totalQty);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(35);
      }

      setOrders((prev) =>
        prev.map((ord) => {
          if (ord._id !== activeOrder._id) return ord;
          return {
            ...ord,
            items: ord.items.map((it) =>
              it._id === item._id
                ? {
                    ...it,
                    pickedQuantity: nextPicked,
                    status: 'PENDING',
                  }
                : it
            ),
          };
        })
      );
      setLastLocalUnitUndo({
        orderId: activeOrder._id,
        itemId: item._id,
        previousPickedQuantity: currentPicked,
        expectedPickedQuantity: nextPicked,
      });

      const remaining = totalQty - nextPicked;
      showToast(`Scanned unit ${nextPicked}/${totalQty} for ${item.name} (${remaining} remaining)`, 'info');
      return;
    }

    // All units declared: from here a provider mutation may be sent, so any
    // purely-local undo token for this line is no longer valid.
    setLastLocalUnitUndo((token) =>
      token?.orderId === activeOrder._id && token.itemId === item._id ? null : token
    );
    sounds.playPickSuccess();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 40, 50]);
    }

    // Optimistic UI update
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord._id !== activeOrder._id) return ord;
        return {
          ...ord,
          items: ord.items.map((it) =>
            it._id === item._id
              ? {
                  ...it,
                  status: 'PICKED',
                  pickedWeight: weight || it.pickedWeight,
                  pickedQuantity: totalQty,
                  syncState: 'SYNCED',
                }
              : it
          ),
        };
      })
    );

    showToast(`All ${totalQty}x ${item.name} declared & picked!`, 'success');

    // Queue mutation locally in IndexedDB if offline or send directly
    const updateAction: UpdateOrderItemAction = {
      itemId: item._id,
      action: 'PICK',
      properties: {
        pickedWeight: weight,
      },
    };

    if (!isOnline) {
      await offlineQueue.enqueue(activeOrder._id, [updateAction]);
      showToast('Saved offline. Will sync once connected.', 'info');
    } else {
      try {
        await fetch(
          `/api/orders/${encodeURIComponent(activeOrder._id)}/items/${encodeURIComponent(item._id)}/pick`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pickedWeight: weight,
              pickerName: currentUser.name,
            }),
          }
        );
      } catch {
        await offlineQueue.enqueue(activeOrder._id, [updateAction]);
      }
    }
  };

  // Safe Group Pick All: revalidate against the latest in-memory order at execution time.
  // The UI already fingerprints the hold gesture; this second gate prevents a stale
  // item snapshot from reaching per-line mutations if live state moved in between.
  const handlePickAllGroupItems = async (group: PickingGroup, safeItems: PickingItem[]) => {
    if (!activeOrder) return;

    const latestOrder =
      orders.find((order) => order._id === activeOrder._id) || activeOrder;
    const latestPlan = buildGroupPickAllPlan(
      group,
      latestOrder.items,
      latestOrder.groups || [group]
    );
    const requestedIds = new Set(safeItems.map((item) => item._id));
    const latestSafeItems = latestOrder.items.filter(
      (item) =>
        requestedIds.has(item._id) &&
        latestPlan.eligibleItemIds.includes(item._id)
    );

    if (
      latestPlan.blockedItems.length > 0 ||
      latestSafeItems.length !== safeItems.length
    ) {
      sounds.playErrorBuzz();
      showToast('Order changed while confirming. Review the bundle and hold again.', 'info');
      return;
    }

    sounds.playPickSuccess();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([30, 40, 50]);
    }

    for (const item of latestSafeItems) {
      await handleDirectPick(item, undefined, true);
    }
    showToast(`Picked ${latestSafeItems.length} items in ${group.name}`, 'success');
  };

  const openAuditTrail = async () => {
    if (!activeOrder) return;
    try {
      const res = await fetch(
        `/api/audit-logs?orderId=${encodeURIComponent(activeOrder._id)}`
      );
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(Array.isArray(data.logs) ? data.logs : []);
      }
    } catch {
      setAuditLogs([]);
    }
    setShowAuditDrawer(true);
  };

  const undoLastLocalUnit = () => {
    if (!lastLocalUnitUndo) return;
    setOrders((prev) =>
      prev.map((order) => {
        if (order._id !== lastLocalUnitUndo.orderId) return order;
        const current = order.items.find((item) => item._id === lastLocalUnitUndo.itemId);
        if (
          !current ||
          current.status !== 'PENDING' ||
          (current.pickedQuantity || 0) !== lastLocalUnitUndo.expectedPickedQuantity
        ) {
          return order;
        }
        return {
          ...order,
          items: order.items.map((item) =>
            item._id === lastLocalUnitUndo.itemId
              ? {
                  ...item,
                  pickedQuantity: lastLocalUnitUndo.previousPickedQuantity,
                }
              : item
          ),
        };
      })
    );
    showToast('Last local unit declaration undone', 'info');
    setLastLocalUnitUndo(null);
  };

  // Substitute Item
  const handleReplaceItem = async (
    item: PickingItem,
    rep: { plu: string; name: string; price: number; quantity: number; reason?: string }
  ) => {
    if (!activeOrder) return;
    setShowSubModal(null);

    // Optimistic update
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord._id !== activeOrder._id) return ord;
        return {
          ...ord,
          items: ord.items.map((it) =>
            it._id === item._id
              ? {
                  ...it,
                  status: 'REPLACED',
                  replacement: rep,
                  syncState: 'SYNCED',
                }
              : it
          ),
        };
      })
    );

    const updateAction: UpdateOrderItemAction = {
      itemId: item._id,
      action: 'REPLACE',
      reason: rep.reason || 'OUT_OF_STOCK',
      properties: {
        replaceItem: {
          plu: rep.plu,
          name: rep.name,
          quantity: rep.quantity,
          price: rep.price,
          subItems: [],
        },
      },
    };

    if (!isOnline) {
      await offlineQueue.enqueue(activeOrder._id, [updateAction]);
    } else {
      await fetch(`/api/orders/${encodeURIComponent(activeOrder._id)}/batch-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [updateAction],
          pickerName: currentUser.name,
        }),
      });
    }

    showToast(`Substituted ${item.name} with ${rep.name}`, 'success');
  };

  // Adjust Quantity
  const handleAdjustQuantity = async (item: PickingItem, newQty: number) => {
    if (!activeOrder) return;
    setShowSubModal(null);

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord._id !== activeOrder._id) return ord;
        return {
          ...ord,
          items: ord.items.map((it) =>
            it._id === item._id
              ? {
                  ...it,
                  quantity: newQty,
                  status: newQty === 0 ? 'REMOVED' : 'PENDING',
                  syncState: 'SYNCED',
                }
              : it
          ),
        };
      })
    );

    const updateAction: UpdateOrderItemAction = {
      itemId: item._id,
      action: 'ADJUST',
      reason: 'ITEM_AMENDMENT',
      properties: { quantity: newQty },
    };

    await fetch(`/api/orders/${encodeURIComponent(activeOrder._id)}/batch-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [updateAction],
        pickerName: currentUser.name,
      }),
    });

    showToast(`Adjusted quantity to ${newQty}`, 'success');
  };

  // Remove Item
  const handleRemoveItem = async (item: PickingItem, reason: RemovalReason) => {
    if (!activeOrder) return;
    setShowSubModal(null);

    setOrders((prev) =>
      prev.map((ord) => {
        if (ord._id !== activeOrder._id) return ord;
        return {
          ...ord,
          items: ord.items.map((it) =>
            it._id === item._id
              ? {
                  ...it,
                  status: 'REMOVED',
                  removalReason: reason,
                  syncState: 'SYNCED',
                }
              : it
          ),
        };
      })
    );

    const updateAction: UpdateOrderItemAction = {
      itemId: item._id,
      action: 'REMOVE',
      reason,
    };

    await fetch(`/api/orders/${encodeURIComponent(activeOrder._id)}/batch-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: [updateAction],
        pickerName: currentUser.name,
      }),
    });

    showToast(`Removed ${item.name} (${reason})`, 'info');
  };

  // Finalize order
  const handleFinishOrder = async (courierCount?: number, courierNotes?: string) => {
    if (!activeOrder) return;
    setShowSummaryModal(false);

    try {
      await fetch(`/api/orders/${encodeURIComponent(activeOrder._id)}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courierCount,
          courierNotes,
          pickerName: currentUser.name,
        }),
      });

      showToast(`Order ${activeOrder.channelOrderDisplayId} finalized successfully!`, 'success');
      setCurrentView('queue');
      fetchOrders();
    } catch (err: any) {
      showToast(`Error completing order: ${err.message}`, 'error');
    }
  };

  // Reject order
  const handleRejectOrder = async (reason: string, reasonType: string) => {
    if (!activeOrder) return;
    setShowSummaryModal(false);
    setShowSubModal(null);

    try {
      await fetch(`/api/orders/${encodeURIComponent(activeOrder._id)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          reasonType,
          pickerName: currentUser.name,
        }),
      });

      showToast(`Order ${activeOrder.channelOrderDisplayId} rejected`, 'info');
      setCurrentView('queue');
      fetchOrders();
    } catch (err: any) {
      showToast(`Error rejecting order: ${err.message}`, 'error');
    }
  };

  // Update couriers
  const handleUpdateCouriers = async (count: number, notes?: string) => {
    if (!activeOrder) return;
    setShowCouriersModal(false);

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(activeOrder._id)}/couriers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          reason: notes,
          updatedBy: currentUser.name,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update couriers');
      }

      showToast(`Couriers count updated to ${count}`, 'success');
      fetchOrders();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Filtered orders for queue view
  const filteredOrders = useMemo(() => {
    if (queueTab === 'ALL') return orders;
    return orders.filter((o) => o.pickerStatus === queueTab);
  }, [orders, queueTab]);

  // -------------------------------------------------------------
  // VIEW: HEADSUP KDS DISPLAY (QP-05)
  // -------------------------------------------------------------
  if (currentView === 'headsup') {
    return (
      <HeadsUpDisplay
        onBackToPicker={() => {
          if (typeof window !== 'undefined' && window.history.pushState) {
            window.history.pushState({}, '', '/');
          }
          setCurrentView('queue');
        }}
        onSelectOrderToPick={(orderId) => {
          setSelectedOrderId(orderId);
          setCurrentView('picking');
        }}
        storeId={currentUser.storeId}
        storeName={currentUser.storeName}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ltx-canvas)] text-[var(--ltx-ink)] flex flex-col font-sans selection:bg-[var(--ltx-brand)] selection:text-white">
      {/* 1. TOP GLOBAL APP BAR */}
      <header className="sticky top-0 z-40 bg-[var(--ltx-brand)] text-white border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setCurrentView('queue')}
              className="flex items-center gap-2.5 min-w-0 rounded-xl ltx-focus"
              title="QuickPick home"
            >
              <div className="w-8 h-8 rounded-xl overflow-hidden bg-white/8 border border-white/15 shrink-0">
                <img src="/icon.svg" alt="LTx" className="w-full h-full object-cover" />
              </div>
              <div className="text-left min-w-0">
                <div className="ltx-display text-[15px] font-semibold leading-none text-white">QuickPick</div>
                <div className="text-[10px] text-white/55 mt-1 leading-none truncate">by LTx · {currentUser.storeName}</div>
              </div>
            </button>

            <nav className="hidden sm:flex items-center gap-1 ml-2" aria-label="QuickPick views">
              <button
                type="button"
                onClick={() => setCurrentView('ordering')}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition ${currentView === 'ordering'
                    ? 'bg-white text-[var(--ltx-brand)]'
                    : 'text-white/70 hover:text-white hover:bg-white/8'}`}
              >
                Shop demo
              </button>
              <button
                type="button"
                onClick={() => setCurrentView('queue')}
                className={`min-h-[36px] px-3 rounded-lg text-xs font-medium transition ${currentView === 'queue' || currentView === 'picking'
                    ? 'bg-white text-[var(--ltx-brand)]'
                    : 'text-white/70 hover:text-white hover:bg-white/8'}`}
              >
                Pick
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.history.pushState) {
                    window.history.pushState({}, '', '/headsup');
                  }
                  setCurrentView('headsup');
                }}
                className="hidden md:flex min-h-[36px] px-3 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/8 transition items-center gap-1.5"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                HeadsUp
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isOnline && (
              <div className="flex items-center gap-1.5 px-2.5 min-h-[36px] rounded-lg bg-amber-300/15 text-amber-100 border border-amber-200/20 text-[11px] font-medium">
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Offline</span>
              </div>
            )}

            <details className="relative group">
              <summary className="list-none cursor-pointer min-h-[36px] px-3 rounded-lg bg-white/8 hover:bg-white/12 border border-white/10 text-white/80 hover:text-white text-xs font-medium flex items-center gap-1.5 transition">
                Demo
                <ChevronDown className="w-3.5 h-3.5 text-white/50" />
              </summary>
              <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white text-neutral-800 border border-neutral-200 shadow-xl p-1.5 z-50">
                <button
                  type="button"
                  onClick={() => setShowDavidVictorModal(true)}
                  className="w-full min-h-[42px] px-3 rounded-lg hover:bg-neutral-50 text-left text-xs font-medium flex items-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4 text-[var(--ltx-brand)]" />
                  Inject demo order
                </button>
                <button
                  type="button"
                  onClick={() => setShowSimulatorDrawer(true)}
                  className="w-full min-h-[42px] px-3 rounded-lg hover:bg-neutral-50 text-left text-xs font-medium flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-[var(--ltx-brand)]" />
                  Deliverect simulator
                </button>
                <button
                  type="button"
                  onClick={() => setAndroidFrameMode(!androidFrameMode)}
                  className="w-full min-h-[42px] px-3 rounded-lg hover:bg-neutral-50 text-left text-xs font-medium flex items-center gap-2"
                >
                  <Smartphone className="w-4 h-4 text-[var(--ltx-brand)]" />
                  {androidFrameMode ? 'Fluid layout' : 'Phone frame'}
                </button>
                <div className="border-t border-neutral-100 mt-1 pt-1">
                  <PWAInstallButton />
                </div>
              </div>
            </details>

            <button
              onClick={() => setShowStorePicker(true)}
              className="w-9 h-9 rounded-full bg-white text-[var(--ltx-brand)] text-xs font-bold flex items-center justify-center border border-white/20 ltx-focus"
              title={`Active picker: ${currentUser.name}`}
            >
              {currentUser.name.charAt(0)}
            </button>
          </div>
        </div>

        {currentView !== 'ordering' && (
          <TeamPresenceBar
            currentUser={currentUser}
            activePickers={activeTeam}
            onSwitchUser={(user) => setCurrentUser(user)}
            onOpenStoreSelector={() => setShowStorePicker(true)}
          />
        )}
      </header>

      {/* 2. TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed top-20 inset-x-0 z-50 flex justify-center pointer-events-none px-4 animate-in slide-in-from-top duration-200">
          <div
            className={`px-3 py-1.5 rounded-md shadow-sm text-xs font-medium border flex items-center gap-2 ${
              toastMsg.type === 'success'
                ? 'bg-white text-emerald-800 border-emerald-300'
                : toastMsg.type === 'error'
                ? 'bg-white text-rose-800 border-rose-300'
                : 'bg-white text-neutral-800 border-neutral-200'
            }`}
          >
            {toastMsg.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
            {toastMsg.type === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
            {toastMsg.type === 'info' && <Sparkles className="w-3.5 h-3.5 text-indigo-500" />}
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}

      {/* 3. MAIN WORKSPACE */}
      <div className={`flex-1 flex flex-col items-center ${androidFrameMode ? 'py-4 px-2' : 'w-full'}`}>
        <main
          className={`flex-1 flex flex-col transition-all duration-300 ${
            androidFrameMode
              ? 'w-full max-w-[400px] bg-white border border-neutral-300/80 rounded-2xl shadow-xl overflow-hidden p-3 my-2'
              : 'max-w-4xl w-full mx-auto p-4'
          }`}
        >
          {androidFrameMode && (
            <div className="h-6 -mt-1 mb-2 px-2 flex items-center justify-between text-[11px] font-mono text-neutral-400 border-b border-neutral-100 shrink-0">
              <span className="font-semibold text-neutral-700">09:41</span>
              {/* Front Camera Hole Punch */}
              <div className="w-3 h-3 rounded-full bg-neutral-200 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                <span>5G</span>
                <span>98%</span>
              </div>
            </div>
          )}

        {/* ======================================================== */}
        {/* VIEW 0: DELIVEROO / UBER EATS CONSUMER ORDERING APP       */}
        {/* ======================================================== */}
        {currentView === 'ordering' && (
          <ConsumerOrderingApp
            onSwitchToPicker={(orderId) => {
              setSelectedOrderId(orderId);
              setCurrentView('picking');
            }}
            onSwitchToHeadsUp={() => {
              if (typeof window !== 'undefined' && window.history.pushState) {
                window.history.pushState({}, '', '/headsup');
              }
              setCurrentView('headsup');
            }}
          />
        )}

        {/* ======================================================== */}
        {/* VIEW A: ORDER QUEUE                                       */}
        {/* ======================================================== */}
        {currentView === 'queue' && (
          <div className="flex-1 flex flex-col space-y-3">
            {/* Queue Header & Actions */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="ltx-display text-xl font-semibold text-[var(--ltx-ink)]">Pick queue</h1>
                <p className="text-xs text-neutral-500">
                  {orders.length} orders scheduled for {currentUser.storeName}
                </p>
              </div>

              <button
                onClick={fetchOrders}
                className="min-h-[40px] min-w-[40px] rounded-xl ltx-secondary flex items-center justify-center transition"
                title="Refresh orders"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Clean Segmented Filter Tabs */}
            <div className="flex bg-[#e9eeee] dark:bg-neutral-800 p-1 rounded-xl text-xs">
              {[
                { key: 'ALL', label: 'All Orders', count: orders.length },
                {
                  key: 'NOT_STARTED',
                  label: 'To Pick',
                  count: orders.filter((o) => o.pickerStatus === 'NOT_STARTED').length,
                },
                {
                  key: 'IN_PROGRESS',
                  label: 'Picking',
                  count: orders.filter((o) => o.pickerStatus === 'IN_PROGRESS').length,
                },
                {
                  key: 'COMPLETED',
                  label: 'Done',
                  count: orders.filter((o) => o.pickerStatus === 'COMPLETED').length,
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setQueueTab(tab.key as any)}
                  className={`flex-1 py-1.5 rounded-md font-medium transition flex items-center justify-center gap-1.5 ${
                    queueTab === tab.key
                      ? 'bg-white text-neutral-900 shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1 rounded-full font-mono ${
                      queueTab === tab.key ? 'bg-neutral-100 text-neutral-800 font-semibold' : 'text-neutral-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Order Cards Grid */}
            <div className="space-y-2 flex-1">
              {filteredOrders.length === 0 ? (
                <div className="py-14 text-center bg-white rounded-lg border border-neutral-200/80 p-8 shadow-xs">
                  <Package className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <h3 className="text-sm font-semibold text-neutral-800 mb-1">No Orders in this View</h3>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-3">
                    Orders received from Deliverect will appear here automatically.
                  </p>
                  <button
                    onClick={() => setShowSimulatorDrawer(true)}
                    className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition"
                  >
                    Open Simulator to Inject Order
                  </button>
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const minutesLeft = (order as any).minutesRemaining ?? 25;
                  const isUrgent = order.slaStatus === 'CRITICAL' || order.slaStatus === 'OVERDUE';
                  const isWarning = order.slaStatus === 'WARNING';

                  return (
                    <div
                      key={order._id}
                      onClick={() => handleStartOrder(order)}
                      className={`p-3.5 rounded-lg border transition cursor-pointer relative bg-white hover:border-neutral-300/90 shadow-xs group ${
                        order.pickerStatus === 'IN_PROGRESS'
                          ? 'border-[#7aa0aa] ring-1 ring-[#c7d9dd]'
                          : isUrgent
                          ? 'border-rose-200'
                          : 'border-neutral-200/80'
                      }`}
                    >
                      {/* Top Row: Channel ID & SLA */}
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">
                            {order.channelOrderDisplayId}
                          </span>
                          <span className="text-sm font-semibold text-neutral-900">
                            {order.customer.name}
                          </span>
                        </div>

                        {/* Quiet SLA Indicator */}
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              order.slaStatus === 'OVERDUE' || order.slaStatus === 'CRITICAL'
                                ? 'bg-rose-500'
                                : isWarning
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                          <span>
                            {minutesLeft < 0
                              ? `${Math.abs(minutesLeft)}m overdue`
                              : `${minutesLeft}m left`}
                          </span>
                        </div>
                      </div>

                      {/* Customer Note if present */}
                      {order.note && (
                        <p className="text-xs text-amber-800 italic mb-2 line-clamp-1">
                          "{order.note}"
                        </p>
                      )}

                      {/* Bottom Row: Items count & Action */}
                      <div className="flex items-center justify-between text-xs border-t border-neutral-100 pt-2 text-neutral-500">
                        <div className="flex items-center gap-2">
                          <span>
                            <strong className="text-neutral-800 font-mono font-medium">{order.items.length}</strong> items
                          </span>
                          <span>·</span>
                          <span className="capitalize">{(order.orderType || 'DELIVERY').toLowerCase()}</span>
                        </div>

                        <div className="flex items-center gap-1 font-medium text-[var(--ltx-brand)] group-hover:translate-x-0.5 transition">
                          <span>
                            {order.pickerStatus === 'IN_PROGRESS' ? 'Resume Pick' : 'Start Pick'}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW B: PICK SCREEN                                       */}
        {/* ======================================================== */}
        {currentView === 'picking' && activeOrder && (
          <div className="flex-1 flex flex-col space-y-3">
            {/* Top Order Nav & Modes */}
            <div className="ltx-card flex items-center justify-between px-3 py-2.5">
              <button
                onClick={() => setCurrentView('queue')}
                className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 font-medium transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Queue</span>
              </button>

              <div className="text-center">
                <span className="text-xs font-mono font-medium text-neutral-900">
                  {activeOrder.channelOrderDisplayId}
                </span>
                <span className="text-xs text-neutral-500 block truncate max-w-[140px]">
                  {activeOrder.customer.name}
                </span>
              </div>

              {/* View mode toggle (Swipe vs List) & Finish Button */}
              <div className="flex items-center gap-2">
                <div className="flex bg-neutral-100 p-0.5 rounded-md border border-neutral-200 text-xs">
                  <button
                    onClick={() => setPickMode('swipe')}
                    className={`p-1 rounded transition ${
                      pickMode === 'swipe' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-400'
                    }`}
                    title="Card Swipe Mode"
                  >
                    <Layers className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPickMode('list')}
                    className={`p-1 rounded transition ${
                      pickMode === 'list' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-400'
                    }`}
                    title="List View"
                  >
                    <ListOrdered className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setShowSummaryModal(true)}
                  className="min-h-[40px] px-3 rounded-xl ltx-primary text-white font-medium text-xs flex items-center gap-1.5 transition"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Finish</span>
                </button>
              </div>
            </div>

            {/* Customer Note Alert Banner if present */}
            {activeOrder.note && (
              <div className="p-2 rounded-lg bg-amber-50/80 border border-amber-200/80 flex items-start gap-2 text-xs text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-medium mr-1">Customer Note:</strong>
                  <span>{activeOrder.note}</span>
                </div>
              </div>
            )}

            {/* QP-02 / QP-04 Order Group & Bundle Rail */}
            {activeOrder.groups && activeOrder.groups.length > 0 && (
              <OrderGroupRail
                groups={activeOrder.groups}
                items={activeOrder.items}
                onPickAllSafeGroupItems={(group, safeItems) => {
                  handlePickAllGroupItems(group, safeItems);
                }}
              />
            )}

            {/* MODE 1: TINDER-STYLE SWIPE CARDS */}
            {pickMode === 'swipe' && (
              <div className="flex-1 flex flex-col justify-center py-1">
                <SwipeCardPicker
                  items={activeOrder.items}
                  groups={activeOrder.groups}
                  onPickUnit={(item, pickAll) => handleDirectPick(item, undefined, pickAll)}
                  onUnavailable={(item) => setShowSubModal(item)}
                  onWeightRequest={(item) => setShowWeightModal(item)}
                  onOpenPhotoPick={() => setShowPhotoModal(true)}
                  onOpenBarcodeScan={() => setShowCameraScanner(true)}
                />
              </div>
            )}

            {/* MODE 2: DETAILED SEQUENCED LIST VIEW */}
            {pickMode === 'list' && (
              <div className="space-y-2 flex-1 overflow-y-auto pr-0.5">
                {/* Auxiliary Scan Tools Bar in List Mode */}
                <div className="flex items-center justify-between pb-1 text-xs">
                  <span className="text-neutral-500 font-medium">
                    {activeOrder.items.filter((i) => i.status === 'PICKED').length} of {activeOrder.items.filter(i => !i.isTextInstruction).length} pickable items picked
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowCameraScanner(true)}
                      className="px-2 py-1 rounded-md bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-600 flex items-center gap-1 text-xs font-medium shadow-xs transition"
                    >
                      <Camera className="w-3.5 h-3.5 text-neutral-500" />
                      <span>Scan Barcode</span>
                    </button>
                    <button
                      onClick={() => setShowPhotoModal(true)}
                      className="px-2 py-1 rounded-md bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-600 flex items-center gap-1 text-xs font-medium shadow-xs transition"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      <span>AI Photo</span>
                    </button>
                  </div>
                </div>

                {activeOrder.items.map((item) => {
                  const isPicked = item.status === 'PICKED';
                  const isReplaced = item.status === 'REPLACED';
                  const isRemoved = item.status === 'REMOVED';
                  const isMulti = (item.quantity || 1) > 1;
                  const pickedCount = item.pickedQuantity || 0;
                  const isTextNote = !!item.isTextInstruction;

                  return (
                    <div
                      key={item._id}
                      className={`p-3 rounded-lg border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isTextNote
                          ? 'bg-neutral-50 border-neutral-200/60 opacity-80'
                          : isPicked
                          ? 'bg-emerald-50/30 border-emerald-200/80 opacity-90'
                          : isReplaced
                          ? 'bg-amber-50/30 border-amber-200/80'
                          : isRemoved
                          ? 'bg-neutral-100 border-neutral-200 line-through opacity-50'
                          : 'bg-white border-neutral-200/80 shadow-xs'
                      }`}
                    >
                      {/* Product Image & Main Details */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* Visual Product Image */}
                        {!isTextNote && (
                          <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-md overflow-hidden border border-neutral-200/80 bg-neutral-50 shrink-0">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-400 bg-neutral-100">
                                <ShoppingBag className="w-5 h-5 opacity-40" />
                              </div>
                            )}

                            {/* Price Tag Overlay */}
                            {item.price > 0 && (
                              <div className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-white/95 text-[10px] font-mono font-medium text-neutral-900 border border-neutral-200/80">
                                £{(item.price / 100).toFixed(2)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Title & Metadata */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 text-xs text-neutral-500 font-medium flex-wrap">
                            {item.componentRole && (
                              <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-neutral-100 border border-neutral-200 text-neutral-700">
                                {item.componentRole}
                              </span>
                            )}
                            {item.aisle ? (
                              <span>
                                {item.aisle}
                                {item.shelf ? ` · ${item.shelf}` : ''}
                              </span>
                            ) : (
                              <span className="italic text-neutral-400">
                                {isTextNote ? 'Customisation Note' : 'Location not set'}
                              </span>
                            )}
                            {item.temperature && (
                              <span className="text-[10px] text-neutral-400">({item.temperature})</span>
                            )}
                          </div>

                          <h4 className={`text-xs sm:text-sm font-semibold text-neutral-900 truncate mb-0.5 ${isTextNote ? 'italic text-neutral-600' : ''}`}>
                            {item.name}
                          </h4>

                          <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono">
                            {item.plu && <span>PLU: {item.plu}</span>}
                            {item.pickedWeight && (
                              <span className="text-emerald-700 font-sans">({item.pickedWeight}kg)</span>
                            )}
                            {isReplaced && item.replacement && (
                              <span className="text-amber-700 font-sans truncate">↳ Sub: {item.replacement.name}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Quantity & Actions (or Note badge for text instructions) */}
                      {isTextNote ? (
                        <div className="flex items-center justify-end">
                          <span className="text-xs text-neutral-400 italic px-2 py-1 rounded bg-neutral-100">
                            Instruction only
                          </span>
                        </div>
                      ) : (
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                          {/* Obvious Quantity Badge */}
                          <div className="flex items-center gap-2">
                            <div className={`px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border ${
                              isMulti
                                ? 'bg-amber-50 border-amber-200/80 text-amber-900'
                                : 'bg-neutral-100 border-neutral-200/80 text-neutral-800'
                            }`}>
                              <span className="text-[10px] font-medium text-neutral-500">QTY</span>
                              <span className="text-xs font-semibold">{item.quantity}</span>
                            </div>

                            {isMulti && !isPicked && (
                              <span className="text-[11px] text-neutral-600 font-medium">
                                {pickedCount}/{item.quantity} declared
                              </span>
                            )}
                          </div>

                          {/* Status / Buttons */}
                          {isPicked ? (
                            <div className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-medium flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Picked</span>
                            </div>
                          ) : isReplaced ? (
                            <div className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 text-xs font-medium">
                              Substituted
                            </div>
                          ) : isRemoved ? (
                            <div className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-500 border border-neutral-200 text-xs font-medium">
                              Removed
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setShowSubModal(item)}
                                className="p-1.5 rounded-md bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-500 transition"
                                title="Unavailable / Substitute"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              </button>

                              {/* Declare 1 Unit Button */}
                              <button
                                onClick={() => {
                                  if (item.isWeight) setShowWeightModal(item);
                                  else handleDirectPick(item, undefined, false);
                                }}
                                className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center gap-1 shadow-xs active:scale-[0.98] transition"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>{isMulti ? `+1 (${pickedCount + 1}/${item.quantity})` : 'Pick'}</span>
                              </button>

                              {/* Declare All button for multi-qty (guarded) */}
                              {isMulti && (() => {
                                const reasons = getPickAllBlockReasonsForLine(
                                  item,
                                  activeOrder.groups || []
                                );
                                return reasons.length === 0 ? (
                                  <HoldToConfirmButton
                                    guardKey={JSON.stringify({
                                      id: item._id,
                                      pickedQuantity: item.pickedQuantity || 0,
                                      quantity: item.quantity,
                                      status: item.status,
                                      syncState: item.syncState || null,
                                      reasons,
                                    })}
                                    holdMs={650}
                                    onConfirm={() => handleDirectPick(item, undefined, true)}
                                    className="min-h-[40px] px-2.5 rounded-xl ltx-secondary text-[11px] font-semibold"
                                    label="Hold · All"
                                    title="Hold to declare all remaining units"
                                  />
                                ) : null;
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Audit & Summary Footer */}
            <div className="flex items-center justify-between text-xs text-neutral-500 pt-2 border-t border-neutral-200/80">
              <button
                onClick={() => setShowAuditDrawer(true)}
                className="flex items-center gap-1 text-neutral-500 hover:text-neutral-800 transition"
              >
                <History className="w-3.5 h-3.5" /> <span>Audit Trail</span>
              </button>

              <button
                onClick={() => setShowCouriersModal(true)}
                className="flex items-center gap-1 text-neutral-600 hover:text-neutral-900 font-medium transition"
              >
                <Bike className="w-3.5 h-3.5" /> <span>Couriers: {activeOrder.courierCount || 1}</span>
              </button>
            </div>
          </div>
        )}
          {androidFrameMode && (
            <div className="h-3 mt-2 flex items-center justify-center shrink-0">
              <div className="w-20 h-1 bg-neutral-300 rounded-full" />
            </div>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* 4. MODALS & DRAWERS                                      */}
      {/* ======================================================== */}

      {/* Camera Barcode Scanner */}
      {showCameraScanner && (
        <CameraBarcodeScanner
          onScan={(code) => {
            setShowCameraScanner(false);
            handleBarcodeScanned(code);
          }}
          onClose={() => setShowCameraScanner(false)}
          activeItem={activeOrder?.items.find((i) => i.status === 'PENDING')}
        />
      )}

      {/* Altie AI Photo Recognition */}
      {showPhotoModal && activeOrder && (
        <PhotoRecognitionModal
          orderId={activeOrder._id}
          candidateItems={activeOrder.items}
          onMatched={(item) => {
            setShowPhotoModal(false);
            if (item.isWeight) setShowWeightModal(item);
            else handleDirectPick(item);
          }}
          onClose={() => setShowPhotoModal(false)}
        />
      )}

      {/* Variable Weight Entry Modal */}
      {showWeightModal && (
        <WeightEntryModal
          item={showWeightModal}
          onConfirm={(weight) => {
            const it = showWeightModal;
            setShowWeightModal(null);
            handleDirectPick(it, weight);
          }}
          onClose={() => setShowWeightModal(null)}
        />
      )}

      {/* Substitution & Item Issue Modal */}
      {showSubModal && activeOrder && (
        <SubstitutionModal
          orderId={activeOrder._id}
          item={showSubModal}
          onReplace={(rep) => handleReplaceItem(showSubModal, rep)}
          onAdjustQuantity={(qty) => handleAdjustQuantity(showSubModal, qty)}
          onRemove={(reason) => handleRemoveItem(showSubModal, reason)}
          onRequestCancelOrder={() => handleRejectOrder('Critical item unavailable under CANCEL_ORDER action', 'CANCEL_ORDER')}
          onClose={() => setShowSubModal(null)}
        />
      )}

      {/* Couriers Count Modal */}
      {showCouriersModal && (
        <CourierModal
          currentCount={activeOrder?.courierCount || 1}
          onConfirm={(count, notes) => handleUpdateCouriers(count, notes)}
          onClose={() => setShowCouriersModal(false)}
        />
      )}

      {/* Order Summary & Finalize Modal */}
      {showSummaryModal && activeOrder && (
        <OrderSummaryModal
          order={activeOrder}
          onFinish={(courierCount, courierNotes) => handleFinishOrder(courierCount, courierNotes)}
          onRejectOrder={(reason, reasonType) => handleRejectOrder(reason, reasonType)}
          onOpenCouriersModal={() => {
            setShowSummaryModal(false);
            setShowCouriersModal(true);
          }}
          onClose={() => setShowSummaryModal(false)}
        />
      )}

      {/* Order Audit Trail Drawer */}
      {showAuditDrawer && activeOrder && (
        <AuditTrailDrawer
          logs={auditLogs}
          orderId={activeOrder._id}
          onClose={() => setShowAuditDrawer(false)}
        />
      )}

      {/* Deliverect Simulator Test Harness Drawer */}
      {showSimulatorDrawer && (
        <SimulatorDrawer
          onClose={() => setShowSimulatorDrawer(false)}
          onRefreshOrders={fetchOrders}
        />
      )}

      {/* Store Location Switcher Modal */}
      {showStorePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 p-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Select Store Location</h3>
            <div className="space-y-2">
              {stores.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setCurrentUser({ ...currentUser, storeId: s.id, storeName: s.name });
                    setShowStorePicker(false);
                  }}
                  className={`w-full p-2.5 rounded-lg border text-left text-xs transition ${
                    currentUser.storeId === s.id
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-slate-900">{s.name}</div>
                  <div className="text-[11px] text-slate-500">{s.address}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowStorePicker(false)}
              className="mt-4 w-full py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* David Victor Store Ordering Modal */}
      <DavidVictorModal
        isOpen={showDavidVictorModal}
        onClose={() => setShowDavidVictorModal(false)}
        onOrderCreated={(orderId) => {
          fetchOrders();
          setSelectedOrderId(orderId);
          showToast('Order from David Victor Store placed and sequenced by Altie AI!', 'success');
        }}
        currentStoreLocation={currentUser.storeId}
      />
    </div>
  );
}
