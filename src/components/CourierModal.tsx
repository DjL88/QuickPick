/**
 * @file src/components/CourierModal.tsx
 * Dialog for setting courier count on an order (/picking/order/:orderId/couriers).
 */

import React, { useState } from 'react';
import { Bike, Check, X, AlertCircle } from 'lucide-react';

interface CourierModalProps {
  currentCount?: number;
  onConfirm: (count: number, notes?: string) => void;
  onClose: () => void;
}

export const CourierModal: React.FC<CourierModalProps> = ({ currentCount = 1, onConfirm, onClose }) => {
  const [count, setCount] = useState<number>(currentCount || 1);
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (count < 0) {
      setError('Courier count must be a non-negative number (412 Precondition)');
      return;
    }
    onConfirm(count, notes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 p-5 shadow-xl flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Bike className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Courier Assignment</h3>
              <p className="text-xs text-slate-500">Deliverect Generic Picking</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-center">
            <span className="text-xs text-slate-500 block mb-1">Number of Couriers Needed</span>
            <div className="flex items-center justify-center gap-5 my-1">
              <button
                type="button"
                onClick={() => setCount(Math.max(0, count - 1))}
                className="w-9 h-9 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-lg flex items-center justify-center transition shadow-xs"
              >
                -
              </button>
              <span className="text-2xl font-bold font-mono text-slate-900">{count}</span>
              <button
                type="button"
                onClick={() => setCount(count + 1)}
                className="w-9 h-9 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-lg flex items-center justify-center transition shadow-xs"
              >
                +
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              For orders exceeding single delivery bag capacity
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Dispatch Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 3 chilled bags + 1 ambient box"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {error && (
            <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-98"
          >
            <Check className="w-4 h-4" />
            Update Couriers
          </button>
        </form>
      </div>
    </div>
  );
};
