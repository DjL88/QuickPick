/**
 * @file src/components/commerce/ConsumerOrderingApp.tsx
 * Full-featured Deliveroo / Uber Eats style consumer ordering application
 * powered by the Deliverect Commerce API.
 * Seamlessly dispatches customer orders directly into the LTx QuickPick & HeadsUp ecosystem.
 */

import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  Bike,
  Sparkles,
  MapPin,
  Clock,
  ArrowRight,
  ShieldCheck,
  PackageCheck
} from 'lucide-react';
import {
  CommerceStore,
  MenuItem,
  CartItem,
  COMMERCE_STORES
} from '../../data/commerceCatalog.js';
import { StoreListingView } from './StoreListingView.js';
import { RestaurantMenuView } from './RestaurantMenuView.js';
import { ItemCustomizerModal } from './ItemCustomizerModal.js';
import { CartDrawer } from './CartDrawer.js';
import { LiveOrderTrackerModal } from './LiveOrderTrackerModal.js';

interface ConsumerOrderingAppProps {
  onSwitchToPicker?: (orderId: string) => void;
  onSwitchToHeadsUp?: () => void;
}

export const ConsumerOrderingApp: React.FC<ConsumerOrderingAppProps> = ({
  onSwitchToPicker,
  onSwitchToHeadsUp,
}) => {
  // Navigation: Store Selection
  const [selectedStore, setSelectedStore] = useState<CommerceStore | null>(COMMERCE_STORES[0]);

  // Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Modals
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [trackingDisplayId, setTrackingDisplayId] = useState<string | undefined>(undefined);
  const [recentOrderIds, setRecentOrderIds] = useState<string[]>([]);

  // Cart Counts by PLU
  const itemCountsInCart = useMemo(() => {
    const counts: Record<string, number> = {};
    cartItems.forEach((c) => {
      counts[c.plu] = (counts[c.plu] || 0) + c.quantity;
    });
    return counts;
  }, [cartItems]);

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((acc, i) => acc + i.quantity, 0);
  }, [cartItems]);

  const totalCartAmount = useMemo(() => {
    return cartItems.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);
  }, [cartItems]);

  const handleAddToCart = (item: CartItem) => {
    setCartItems((prev) => {
      // If same store and exact same options and bundle selections, increment
      const existingIdx = prev.findIndex(
        (p) =>
          p.plu === item.plu &&
          JSON.stringify(p.selectedOptions) === JSON.stringify(item.selectedOptions) &&
          JSON.stringify(p.bundleSelections) === JSON.stringify(item.bundleSelections) &&
          p.specialInstructions === item.specialInstructions
      );

      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx].quantity += item.quantity;
        return next;
      }
      return [...prev, item];
    });

    setCustomizingItem(null);
  };

  const handleUpdateQuantity = (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(cartItemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((i) => (i.id === cartItemId ? { ...i, quantity: newQty } : i))
    );
  };

  const handleRemoveItem = (cartItemId: string) => {
    setCartItems((prev) => prev.filter((i) => i.id !== cartItemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleOrderPlaced = (result: any) => {
    setIsCartOpen(false);
    if (result.orderId) {
      setTrackingOrderId(result.orderId);
      setTrackingDisplayId(result.channelOrderDisplayId);
      setRecentOrderIds((prev) => [result.orderId, ...prev]);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] bg-neutral-50/60 text-neutral-800 flex flex-col font-sans">
      {/* Sub-header / Location Bar */}
      <div className="bg-white border-b border-neutral-200/80 px-4 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <MapPin className="w-3.5 h-3.5" />
            </div>
            <div className="font-semibold text-neutral-800 flex items-center gap-1.5">
              <span>Delivering to:</span>
              <span className="text-neutral-900 font-bold underline decoration-emerald-500 underline-offset-2">
                142 Oxford St, London
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-bold text-[11px] border border-emerald-200/60">
              <Sparkles className="w-3 h-3 text-emerald-600" /> Deliverect Commerce API Connected
            </span>

            {/* Floating / Header Basket Trigger */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Basket</span>
              {totalCartCount > 0 && (
                <span className="bg-emerald-500 text-neutral-950 px-1.5 py-0.2 rounded-md text-[11px] font-black">
                  {totalCartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      <main className="flex-1 p-4 sm:p-6">
        {selectedStore ? (
          <RestaurantMenuView
            store={selectedStore}
            onBack={() => setSelectedStore(null)}
            onSelectItem={(item) => setCustomizingItem(item)}
            itemCountsInCart={itemCountsInCart}
          />
        ) : (
          <StoreListingView
            onSelectStore={(store) => setSelectedStore(store)}
            activeOrdersCount={recentOrderIds.length}
            onOpenActiveOrder={() => {
              if (recentOrderIds.length > 0) {
                setTrackingOrderId(recentOrderIds[0]);
              }
            }}
          />
        )}
      </main>

      {/* Sticky Bottom Floating Basket Bar (when items in cart on mobile/tablet) */}
      {cartItems.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-40 animate-in slide-in-from-bottom duration-300">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="w-full h-13 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-sm flex items-center justify-between px-5 shadow-2xl shadow-neutral-950/40 border border-neutral-700 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-neutral-950 font-black text-xs flex items-center justify-center">
                {totalCartCount}
              </span>
              <span>View Basket</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">£{totalCartAmount.toFixed(2)}</span>
              <ArrowRight className="w-4 h-4 text-neutral-400" />
            </div>
          </button>
        </div>
      )}

      {/* Item Customizer Modal */}
      {customizingItem && selectedStore && (
        <ItemCustomizerModal
          item={customizingItem}
          store={selectedStore}
          onClose={() => setCustomizingItem(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        store={selectedStore}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onOrderPlaced={handleOrderPlaced}
      />

      {/* Live Order Tracker Modal */}
      {trackingOrderId && (
        <LiveOrderTrackerModal
          orderId={trackingOrderId}
          channelOrderDisplayId={trackingDisplayId}
          onClose={() => setTrackingOrderId(null)}
          onSwitchToPicker={(id) => {
            setTrackingOrderId(null);
            if (onSwitchToPicker) {
              onSwitchToPicker(id);
            }
          }}
          onSwitchToHeadsUp={() => {
            setTrackingOrderId(null);
            if (onSwitchToHeadsUp) {
              onSwitchToHeadsUp();
            }
          }}
        />
      )}
    </div>
  );
};
