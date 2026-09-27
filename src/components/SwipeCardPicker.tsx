/**
 * @file src/components/SwipeCardPicker.tsx
 * LTx Picker - Clean, modern swipe card picker.
 * - Calmer typography with DM Sans
 * - Clean lines & subtle hairline borders
 * - Crisp product photography
 * - High-clarity, decluttered quantity tracking
 */

import React, { useState, useRef } from 'react';
import {
  Check,
  X,
  Sparkles,
  Scale,
  MapPin,
  Tag,
  ShieldAlert,
  Camera,
} from 'lucide-react';
import { PickingItem, getPickAllBlockReasons } from '@contracts/index.js';
import { sounds } from '../lib/audio.js';

interface SwipeCardPickerProps {
  items: PickingItem[];
  onPickUnit: (item: PickingItem, pickAll?: boolean) => void;
  onUnavailable: (item: PickingItem) => void;
  onWeightRequest: (item: PickingItem) => void;
  onOpenPhotoPick: () => void;
  onOpenBarcodeScan?: () => void;
}

export const SwipeCardPicker: React.FC<SwipeCardPickerProps> = ({
  items,
  onPickUnit,
  onUnavailable,
  onWeightRequest,
  onOpenPhotoPick,
  onOpenBarcodeScan,
}) => {
  const pendingItems = items.filter((i) => i.status === 'PENDING');
  const currentItem = pendingItems[0];

  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [unitFlash, setUnitFlash] = useState<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  if (!currentItem) {
    return (
      <div className="py-12 px-6 text-center bg-white rounded-xl border border-neutral-200/80 flex flex-col items-center shadow-xs max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-lg bg-emerald-50 border border-emerald-200/80 flex items-center justify-center mb-3">
          <Check className="w-6 h-6 text-emerald-600 stroke-[2.5]" />
        </div>
        <h3 className="text-base font-semibold text-neutral-900 mb-1">All Items Picked</h3>
        <p className="text-xs text-neutral-500 max-w-xs mb-4">
          All order items have been verified. Tap Finish to complete and dispatch.
        </p>
        <span className="text-xs font-medium text-emerald-700 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-lg">
          Ready for Finalize
        </span>
      </div>
    );
  }

  const currentPicked = currentItem.pickedQuantity || 0;
  const totalQty = currentItem.quantity || 1;
  const isMultiQty = totalQty > 1;
  const remainingQty = totalQty - currentPicked;
  const quickAllAllowed = getPickAllBlockReasons(currentItem).length === 0;

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startPosRef.current = { x: clientX, y: clientY };
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragOffset({
      x: clientX - startPosRef.current.x,
      y: (clientY - startPosRef.current.y) * 0.3,
    });
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (dragOffset.x > 85) {
      triggerPickUnit(currentItem);
    } else if (dragOffset.x < -85) {
      triggerUnavailable(currentItem);
    }

    setDragOffset({ x: 0, y: 0 });
  };

  const triggerPickUnit = (item: PickingItem) => {
    if (item.isWeight) {
      onWeightRequest(item);
      return;
    }

    setUnitFlash(true);
    setTimeout(() => setUnitFlash(false), 200);

    onPickUnit(item, false);
  };

  const triggerUnavailable = (item: PickingItem) => {
    sounds.playScanBeep();
    onUnavailable(item);
  };

  const rotation = dragOffset.x * 0.05;
  const pickOpacity = Math.min(1, Math.max(0, dragOffset.x / 65));
  const rejectOpacity = Math.min(1, Math.max(0, -dragOffset.x / 65));

  return (
    <div className="relative w-full max-w-sm mx-auto flex flex-col items-center">
      {/* Top Item Progress Line */}
      <div className="w-full flex items-center justify-between px-1 mb-2 text-xs">
        <span className="text-neutral-500 font-medium">
          Item <span className="font-mono text-neutral-900 font-semibold">{items.length - pendingItems.length + 1}</span> of {items.length}
        </span>
        {isMultiQty ? (
          <span className="text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md text-[11px] font-medium">
            {remainingQty} more needed
          </span>
        ) : (
          <span className="text-neutral-400 text-[11px]">Swipe or tap to pick</span>
        )}
      </div>

      {/* Main Interactive Card Stack */}
      <div className="relative w-full h-[435px] select-none touch-none">
        {/* Next Card Preview */}
        {pendingItems[1] && (
          <div className="absolute inset-0 rounded-xl bg-neutral-100/80 border border-neutral-200/80 transform scale-[0.96] translate-y-2.5 opacity-70 pointer-events-none" />
        )}

        {/* Current Active Item Card */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleTouchStart}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
          style={{
            transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className={`absolute inset-0 rounded-xl bg-white border shadow-sm p-4 flex flex-col justify-between overflow-hidden cursor-grab active:cursor-grabbing transition-colors ${
            unitFlash
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'border-neutral-200/90'
          }`}
        >
          {/* Swipe Decision Overlays */}
          {pickOpacity > 0 && (
            <div
              style={{ opacity: pickOpacity }}
              className="absolute top-4 left-4 z-30 px-2.5 py-1 rounded-md border border-emerald-600 bg-emerald-600 text-white font-medium text-xs tracking-wide transform -rotate-6 pointer-events-none shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isMultiQty ? `PICK +1 (${currentPicked + 1}/${totalQty})` : 'PICK ITEM'}</span>
            </div>
          )}

          {rejectOpacity > 0 && (
            <div
              style={{ opacity: rejectOpacity }}
              className="absolute top-4 right-4 z-30 px-2.5 py-1 rounded-md border border-amber-600 bg-amber-600 text-white font-medium text-xs tracking-wide transform rotate-6 pointer-events-none shadow-sm flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>SUB / ISSUE</span>
            </div>
          )}

          {/* CARD TOP ROW: Location & Zone */}
          <div className="flex items-center justify-between z-10 text-xs">
            <div className="flex items-center gap-1.5 text-neutral-700 font-medium">
              <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span>{currentItem.aisle || 'Location not set'}</span>
              <span className="text-neutral-300">·</span>
              <span>{currentItem.shelf || 'Bay not set'}</span>
            </div>

            <div className="flex items-center gap-1.5 text-neutral-500 text-[11px]">
              <span>{currentItem.temperature || 'Ambient'}</span>
              {currentItem.ageRestricted && (
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                  18+
                </span>
              )}
            </div>
          </div>

          {/* HERO PRODUCT IMAGE (Clean, hairline border, no clutter) */}
          <div className="relative w-full h-44 rounded-lg overflow-hidden my-2 border border-neutral-200/80 bg-neutral-50 flex items-center justify-center">
            {currentItem.imageUrl ? (
              <img
                src={currentItem.imageUrl}
                alt={currentItem.name}
                className="w-full h-full object-cover pointer-events-none"
                loading="eager"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 p-4">
                <Tag className="w-8 h-8 mb-1 opacity-40" />
                <span className="text-xs font-mono">PLU {currentItem.plu}</span>
              </div>
            )}

            {/* Price tag */}
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs border border-neutral-200/80 text-xs font-semibold text-neutral-900 font-mono shadow-xs">
              £{(currentItem.price / 100).toFixed(2)}
            </div>

            {/* Category / Dept */}
            {currentItem.department && (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs border border-neutral-200/80 text-[10px] text-neutral-600">
                {currentItem.department}
              </div>
            )}
          </div>

          {/* PRODUCT TITLE & IDENTIFIER */}
          <div className="text-left px-0.5">
            <h3 className="text-[15px] font-semibold text-neutral-900 leading-snug line-clamp-2 mb-1">
              {currentItem.name}
            </h3>

            <div className="flex items-center gap-2 text-xs text-neutral-500 font-mono">
              <span>PLU: {currentItem.plu}</span>
              {currentItem.gtin && currentItem.gtin[0] && (
                <span className="text-neutral-400">· GTIN: {currentItem.gtin[0].slice(-6)}</span>
              )}
            </div>

            {/* Weight notice */}
            {currentItem.isWeight && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-1 rounded-md">
                <Scale className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>Weigh Item ({currentItem.expectedWeight || 1.0}kg expected)</span>
              </div>
            )}
          </div>

          {/* QUANTITY SECTION - Clean, Calm, Modern */}
          <div className="mt-2 pt-2 border-t border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">Required:</span>
              <span className="font-mono text-base font-semibold text-neutral-900">
                {totalQty} {totalQty > 1 ? 'units' : 'unit'}
              </span>
            </div>

            {/* Step Indicators for multi-quantity */}
            {isMultiQty ? (
              <div className="flex items-center gap-1">
                {Array.from({ length: totalQty }).map((_, idx) => {
                  const isUnitDone = idx < currentPicked;
                  const isNextUnit = idx === currentPicked;
                  return (
                    <div
                      key={idx}
                      className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-semibold transition-all ${
                        isUnitDone
                          ? 'bg-emerald-600 text-white'
                          : isNextUnit
                          ? 'bg-amber-50 border border-amber-300 text-amber-800'
                          : 'bg-neutral-100 text-neutral-400'
                      }`}
                      title={`Unit ${idx + 1}`}
                    >
                      {isUnitDone ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-[11px] text-neutral-400">Single item</span>
            )}
          </div>
        </div>
      </div>

      {/* ACTION BUTTONS: Calm, Modern, Clean Lines */}
      <div className="w-full flex items-center gap-2 mt-3 px-1">
        {/* Issue / Substitute Button */}
        <button
          onClick={() => triggerUnavailable(currentItem)}
          className="flex-1 py-2 px-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 font-medium text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
          title="Item Unavailable or Substitute"
        >
          <X className="w-3.5 h-3.5 text-neutral-500" />
          <span>Can't find</span>
        </button>

        {/* Scan Barcode shortcut button */}
        {onOpenBarcodeScan && (
          <button
            onClick={onOpenBarcodeScan}
            className="p-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-600 flex items-center justify-center transition active:scale-[0.98]"
            title="Scan with Camera"
          >
            <Camera className="w-4 h-4 text-neutral-500" />
          </button>
        )}

        {/* AI Vision Photo button */}
        <button
          onClick={onOpenPhotoPick}
          className="p-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-600 flex items-center justify-center transition active:scale-[0.98]"
          title="Photo Recognition"
        >
          <Sparkles className="w-4 h-4 text-indigo-500" />
        </button>

        {/* Primary Pick Button */}
        <button
          onClick={() => triggerPickUnit(currentItem)}
          className="flex-[1.5] py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-[0.98]"
          title={isMultiQty ? `Declare Unit ${currentPicked + 1}` : 'Confirm Pick'}
        >
          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>
            {isMultiQty ? `Pick unit (+1)` : 'Confirm pick'}
          </span>
        </button>
      </div>

      {/* Quick shortcut to declare all remaining */}
      {isMultiQty && quickAllAllowed && (
        <button
          onClick={() => onPickUnit(currentItem, true)}
          className="mt-2 text-[11px] text-neutral-400 hover:text-neutral-700 transition"
        >
          Pick all {totalQty} at once
        </button>
      )}
    </div>
  );
};
