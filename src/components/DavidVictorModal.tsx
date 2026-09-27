/**
 * @file src/components/DavidVictorModal.tsx
 * Interactive ordering portal for github.com/djl88/david-victor.
 * Allows placing simulated orders directly from the David Victor storefront,
 * and displays connection guidelines for integrating the real GitHub repository.
 */

import React, { useState } from 'react';
import {
  X,
  ShoppingBag,
  Plus,
  Minus,
  Check,
  Sparkles,
  ExternalLink,
  Code,
  Copy,
  CheckCircle2,
  Clock,
  MapPin
} from 'lucide-react';
import { sounds } from '../lib/audio.js';

interface DavidVictorItem {
  id: string;
  name: string;
  plu: string;
  price: number;
  temperature: 'AMBIENT' | 'CHILLED' | 'FROZEN';
  imageUrl: string;
  department: string;
  defaultQty: number;
}

const DEFAULT_DV_CATALOG: DavidVictorItem[] = [
  {
    id: 'dv_sourdough',
    name: 'David Victor San Francisco Sourdough (Fresh Baked)',
    plu: '502345',
    price: 380,
    temperature: 'AMBIENT',
    department: 'Artisan Bakery',
    imageUrl: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=600&auto=format&fit=crop&q=80',
    defaultQty: 2,
  },
  {
    id: 'dv_coldbrew',
    name: 'David Victor Reserve Nitro Cold Brew 330ml',
    plu: '735112',
    price: 320,
    temperature: 'CHILLED',
    department: 'Cold Drinks',
    imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80',
    defaultQty: 3,
  },
  {
    id: 'dv_eggs',
    name: 'Organic Pasture-Raised Heritage Eggs (6 Pack)',
    plu: '501889',
    price: 295,
    temperature: 'CHILLED',
    department: 'Dairy & Farm',
    imageUrl: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?w=600&auto=format&fit=crop&q=80',
    defaultQty: 1,
  },
  {
    id: 'dv_avocado',
    name: 'Ripe Hass Avocados (Twin Pack)',
    plu: '4225',
    price: 240,
    temperature: 'AMBIENT',
    department: 'Fresh Produce',
    imageUrl: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600&auto=format&fit=crop&q=80',
    defaultQty: 2,
  },
  {
    id: 'dv_gelato',
    name: 'Madagascan Vanilla Bean Artisan Gelato 500ml',
    plu: '871132',
    price: 520,
    temperature: 'FROZEN',
    department: 'Frozen Desserts',
    imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600&auto=format&fit=crop&q=80',
    defaultQty: 1,
  },
];

interface DavidVictorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (orderId: string) => void;
  currentStoreLocation: string;
}

export const DavidVictorModal: React.FC<DavidVictorModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
  currentStoreLocation,
}) => {
  const [activeTab, setActiveTab] = useState<'store' | 'integration'>('store');
  const [quantities, setQuantities] = useState<Record<string, number>>({
    dv_sourdough: 2,
    dv_coldbrew: 3,
    dv_eggs: 1,
    dv_avocado: 1,
    dv_gelato: 0,
  });

  const [customerName, setCustomerName] = useState('David Leitch');
  const [customerPhone, setCustomerPhone] = useState('+44 7700 900888');
  const [orderNote, setOrderNote] = useState('Handle fresh sourdough gently. Ring doorbell on delivery.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const totalItems = Object.values(quantities).reduce((acc, q) => acc + q, 0);
  const totalAmount = DEFAULT_DV_CATALOG.reduce((acc, it) => acc + it.price * (quantities[it.id] || 0), 0);

  const updateQuantity = (id: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta),
    }));
  };

  const handlePlaceOrder = async () => {
    if (totalItems === 0) return;
    setIsSubmitting(true);

    try {
      const selectedItems = DEFAULT_DV_CATALOG.filter((it) => (quantities[it.id] || 0) > 0).map((it) => ({
        plu: it.plu,
        name: it.name,
        quantity: quantities[it.id],
        price: it.price,
        department: it.department,
        temperature: it.temperature,
        imageUrl: it.imageUrl,
        isWeight: false,
        itemUnavailableActions: ['ITEM_AMENDMENT', 'ITEM_SUBSTITUTION', 'ITEM_REMOVE'],
      }));

      const payload = {
        location: currentStoreLocation,
        customer: {
          name: customerName,
          phone: customerPhone,
        },
        note: orderNote,
        orderType: 'DELIVERY',
        items: selectedItems,
      };

      const res = await fetch('/api/david-victor/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        sounds.playNewOrderAlert();
        onOrderCreated(data.orderId);
        onClose();
      } else {
        alert('Failed to dispatch David Victor order');
      }
    } catch (err: any) {
      alert(`Error placing order: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const webhookPublicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/david-victor/order`
    : 'https://ais-dev-jwnxspsq44ncqqk5ce2hqy-232948319569.europe-west3.run.app/api/david-victor/order';

  const copyToClipboard = () => {
    navigator.clipboard?.writeText(webhookPublicUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <ShoppingBag className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-slate-900">David Victor Store</h2>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                  djl88/david-victor
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Place test orders into Generic Picking engine
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-900 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-1 text-xs">
          <button
            onClick={() => setActiveTab('store')}
            className={`flex-1 py-1.5 font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'store'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Catalog Order ({totalItems})</span>
          </button>

          <button
            onClick={() => setActiveTab('integration')}
            className={`flex-1 py-1.5 font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
              activeTab === 'integration'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Webhook Bridge</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {activeTab === 'store' ? (
            <>
              {/* Customer Info Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600 font-semibold">
                  <span>Customer Details</span>
                  <span className="text-slate-500 font-mono text-[11px]">Channel: DV-STORE</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">Name</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-medium focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">Phone</label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-medium focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">Note</label>
                  <input
                    type="text"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-medium focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-800">Select Items</span>
                  <span className="text-[11px]">Includes multi-qty items</span>
                </div>

                {DEFAULT_DV_CATALOG.map((item) => {
                  const qty = quantities[item.id] || 0;
                  return (
                    <div
                      key={item.id}
                      className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-3 shadow-xs"
                    >
                      {/* Product Image */}
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                      />

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-slate-100 text-slate-600">
                            {item.temperature}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">PLU: {item.plu}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                        <span className="text-xs font-mono font-bold text-slate-800">
                          £{(item.price / 100).toFixed(2)}
                        </span>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1.5 shrink-0 bg-slate-50 border border-slate-200 p-0.5 rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center active:scale-95 transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center font-mono font-bold text-xs text-slate-900">
                          {qty}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-6 h-6 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center font-bold active:scale-95 transition"
                        >
                          <Plus className="w-3 h-3 stroke-[3]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Integration Tab */
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-1">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Connect djl88/david-victor to LTx Picker</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Post orders directly from your companion ordering repo to this instance.
                  The backend accepts both Generic Picking webhooks and native order JSON.
                </p>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Webhook Ingestion URL
                </label>
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono text-slate-800 text-[11px] break-all">
                  <span className="flex-1 select-all">{webhookPublicUrl}</span>
                  <button
                    onClick={copyToClipboard}
                    className="p-1 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 shrink-0 transition"
                    title="Copy URL"
                  >
                    {copiedUrl ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Sample curl test
                </label>
                <pre className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[10px] text-slate-700 overflow-x-auto select-all leading-normal">
{`curl -X POST ${webhookPublicUrl} \\
  -H "Content-Type: application/json" \\
  -d '{
    "channelOrderId": "DV-9901",
    "customer": { "name": "David Leitch", "phone": "+44 7700 900888" },
    "note": "Placed from djl88/david-victor",
    "items": [
      { "plu": "502345", "name": "Artisan Sourdough", "quantity": 2, "price": 380 },
      { "plu": "735112", "name": "Reserve Cold Brew", "quantity": 3, "price": 320 }
    ]
  }'`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'store' && (
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-medium">Total</span>
              <span className="text-sm font-bold font-mono text-slate-900">
                £{(totalAmount / 100).toFixed(2)}{' '}
                <span className="text-xs text-slate-500 font-sans font-normal">({totalItems} items)</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition"
              >
                Cancel
              </button>

              <button
                onClick={handlePlaceOrder}
                disabled={totalItems === 0 || isSubmitting}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Placing...' : 'Place Order'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
