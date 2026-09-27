/**
 * @file src/components/WeightEntryModal.tsx
 * Dialog for capturing variable-weight items (e.g. bananas, fresh produce, meat by kg).
 */

import React, { useState } from 'react';
import { Scale, Check, X, AlertCircle } from 'lucide-react';
import { PickingItem } from '@contracts/index.js';
import { sounds } from '../lib/audio.js';

interface WeightEntryModalProps {
  item: PickingItem;
  onConfirm: (weight: number) => void;
  onClose: () => void;
}

export const WeightEntryModal: React.FC<WeightEntryModalProps> = ({ item, onConfirm, onClose }) => {
  const [weightStr, setWeightStr] = useState<string>(
    item.expectedWeight ? String(item.expectedWeight) : '1.00'
  );
  const unit = item.weightUnit || 'kg';

  const weight = parseFloat(weightStr);
  const isValid = !isNaN(weight) && weight > 0;

  const handleDigit = (digit: string) => {
    if (digit === '.' && weightStr.includes('.')) return;
    if (weightStr === '0' && digit !== '.') {
      setWeightStr(digit);
    } else {
      setWeightStr(weightStr + digit);
    }
  };

  const handleBackspace = () => {
    if (weightStr.length <= 1) {
      setWeightStr('0');
    } else {
      setWeightStr(weightStr.slice(0, -1));
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isValid) return;
    sounds.playPickSuccess();
    onConfirm(weight);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 p-5 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Enter Item Weight</h3>
              <p className="text-xs text-slate-500 truncate max-w-[180px]">{item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Expected weight indicator */}
        {item.expectedWeight && (
          <div className="mb-3 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>Customer requested:</span>
            <span className="font-mono font-bold text-slate-900">
              ~{item.expectedWeight} {unit}
            </span>
          </div>
        )}

        {/* Weight Display Screen */}
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-3 text-center mb-3">
          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">
            Scaled Net Weight
          </div>
          <div className="text-3xl font-bold font-mono text-slate-900 tracking-tight flex items-baseline justify-center gap-1">
            <span>{weightStr}</span>
            <span className="text-base text-slate-500 font-medium">{unit}</span>
          </div>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (key === '⌫') handleBackspace();
                else handleDigit(key);
              }}
              className="py-2.5 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-800 font-mono font-bold text-base transition shadow-xs"
            >
              {key}
            </button>
          ))}
        </div>

        {/* Submit */}
        <button
          onClick={() => handleSubmit()}
          disabled={!isValid}
          className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-98"
        >
          <Check className="w-4 h-4 stroke-[2.5]" />
          Confirm Weight & Pick
        </button>
      </div>
    </div>
  );
};
