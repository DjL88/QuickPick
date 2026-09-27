/**
 * @file src/components/SwipeCardPicker.tsx
 * LTx QuickPick - Mobile-First Touch Swipe Card Picker.
 * - QP-02 / QP-04 Bundle & Group support (deal name, role, bundle progress)
 * - Safe Pick All validation via authoritative getPickAllBlockReasons
 * - Honest data presentation (no fake aisles, bays, or weights)
 * - Touch-optimized ergonomics (min 48px touch targets, sticky bottom controls)
 * - Dark mode and accessibility support
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
  Layers,
  Info,
  AlertCircle,
} from 'lucide-react';
import { PickingItem, PickingGroup, getPickAllBlockReasons } from '@contracts/index.js';
import { sounds } from '../lib/audio.js';

interface SwipeCardPickerProps {
  items: PickingItem[];
  groups?: PickingGroup[];
  onPickUnit: (item: PickingItem, pickAll?: boolean) => void;
  onUnavailable: (item: PickingItem) => void;
  onWeightRequest: (item: PickingItem) => void;
  onOpenPhotoPick: () => void;
  onOpenBarcodeScan?: () => void;
}

export const SwipeCardPicker: React.FC<SwipeCardPickerProps> = ({
  items,
  groups,
  onPickUnit,
  onUnavailable,
  onWeightRequest,
  onOpenPhotoPick,
  onOpenBarcodeScan,
}) => {
  // Exclude non-physical text instructions from interactive card deck (they are visible in group rail/notes)
  const pickableItems = items.filter((i) => !i.isTextInstruction);
  const pendingItems = pickableItems.filter((i) => i.status === 'PENDING');
  const currentItem = pendingItems[0];

  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [unitFlash, setUnitFlash] = useState<boolean>(false);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  if (!currentItem) {
    return (
      <div className="py-12 px-6 text-center bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 flex flex-col items-center shadow-xs max-w-sm mx-auto">
        <div className="w-12 h-12 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-center mb-3">
          <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
        </div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1">All Items Picked</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs mb-4">
          All order items and bundle components have been declared. Ready to review and dispatch.
        </p>
        <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          Ready for Finalize
        </span>
      </div>
    );
  }

  // Active bundle/group context
  const activeGroup = groups?.find(
    (g) => g.id === currentItem.groupId || g.itemIds?.includes(currentItem._id)
  );

  let groupProgressText = '';
  if (activeGroup) {
    const groupItems = pickableItems.filter(
      (i) => i.groupId === activeGroup.id || activeGroup.itemIds?.includes(i._id)
    );
    const groupPicked = groupItems.filter((i) => i.status === 'PICKED').length;
    groupProgressText = `${groupPicked}/${groupItems.length}`;
  }

  const currentPicked = currentItem.pickedQuantity || 0;
  const totalQty = currentItem.quantity || 1;
  const isMultiQty = totalQty > 1;
  const remainingQty = totalQty - currentPicked;

  // Authoritative safety check for Pick All
  const blockReasons = getPickAllBlockReasons(currentItem, activeGroup);
  const isSafeForPickAll = blockReasons.length === 0;

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

    if (dragOffset.x > 80) {
      triggerPickUnit(currentItem);
    } else if (dragOffset.x < -80) {
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
  const pickOpacity = Math.min(1, Math.max(0, dragOffset.x / 60));
  const rejectOpacity = Math.min(1, Math.max(0, -dragOffset.x / 60));

  // Location honest presentation
  const locationDisplay = currentItem.aisle
    ? `${currentItem.aisle}${currentItem.shelf ? ` · ${currentItem.shelf}` : ''}`
    : 'Location not set';

  return (
    <div className="relative w-full max-w-sm mx-auto flex flex-col items-center">
      {/* Top Item / Bundle Progress Line */}
      <div className="w-full flex items-center justify-between px-1 mb-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-neutral-500 dark:text-neutral-400 font-medium">
            Item <span className="font-mono text-neutral-900 dark:text-neutral-100 font-semibold">{pickableItems.length - pendingItems.length + 1}</span> of {pickableItems.length}
          </span>
          {activeGroup && (
            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span>Bundle ({groupProgressText})</span>
            </span>
          )}
        </div>

        {isMultiQty ? (
          <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 px-2 py-0.5 rounded-md text-[11px] font-medium">
            {remainingQty} more needed
          </span>
        ) : (
          <span className="text-neutral-400 dark:text-neutral-500 text-[11px]">Swipe or tap to pick</span>
        )}
      </div>

      {/* Main Interactive Card Stack */}
      <div className="relative w-full h-[450px] select-none touch-none">
        {/* Next Card Preview */}
        {pendingItems[1] && (
          <div className="absolute inset-0 rounded-xl bg-neutral-100/90 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700 transform scale-[0.96] translate-y-2.5 opacity-70 pointer-events-none" />
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
          className={`absolute inset-0 rounded-xl bg-white dark:bg-neutral-900 border shadow-sm p-4 flex flex-col justify-between overflow-hidden cursor-grab active:cursor-grabbing transition-colors ${
            unitFlash
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'border-neutral-200/90 dark:border-neutral-800'
          }`}
        >
          {/* Swipe Decision Overlays */}
          {pickOpacity > 0 && (
            <div
              style={{ opacity: pickOpacity }}
              className="absolute top-4 left-4 z-30 px-3 py-1.5 rounded-md border border-emerald-600 bg-emerald-600 text-white font-medium text-xs tracking-wide transform -rotate-6 pointer-events-none shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{isMultiQty ? `PICK +1 (${currentPicked + 1}/${totalQty})` : 'PICK ITEM'}</span>
            </div>
          )}

          {rejectOpacity > 0 && (
            <div
              style={{ opacity: rejectOpacity }}
              className="absolute top-4 right-4 z-30 px-3 py-1.5 rounded-md border border-amber-600 bg-amber-600 text-white font-medium text-xs tracking-wide transform rotate-6 pointer-events-none shadow-sm flex items-center gap-1.5"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
              <span>SUB / ISSUE</span>
            </div>
          )}

          {/* CARD TOP ROW: Bundle context & Location */}
          <div className="flex flex-col gap-1 z-10">
            {activeGroup && (
              <div className="flex items-center justify-between text-[11px] pb-1 border-b border-neutral-100 dark:border-neutral-800">
                <div className="flex items-center gap-1 text-indigo-700 dark:text-indigo-300 font-medium truncate">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{activeGroup.name}</span>
                </div>
                {currentItem.componentRole && (
                  <span
                    className={`text-[9px] font-mono font-medium px-1.5 py-0.2 rounded uppercase shrink-0 ${
                      currentItem.componentRole === 'COMPONENT'
                        ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                        : currentItem.componentRole === 'MODIFIER'
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                        : currentItem.componentRole === 'CUSTOMISATION'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        : currentItem.componentRole === 'UPSELL'
                        ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                        : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    }`}
                  >
                    {currentItem.componentRole}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-medium">
                <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span className={currentItem.aisle ? '' : 'italic text-neutral-400 dark:text-neutral-500'}>
                  {locationDisplay}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 text-[11px]">
                {currentItem.temperature && (
                  <span>{currentItem.temperature}</span>
                )}
                {currentItem.ageRestricted && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                    18+
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* HERO PRODUCT IMAGE */}
          <div className="relative w-full h-40 sm:h-44 rounded-lg overflow-hidden my-1.5 border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center">
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
                {currentItem.plu ? (
                  <span className="text-xs font-mono">PLU {currentItem.plu}</span>
                ) : (
                  <span className="text-xs text-neutral-400 italic">No image available</span>
                )}
              </div>
            )}

            {/* Price tag (honest: only show if price > 0) */}
            {currentItem.price > 0 && (
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-white/95 dark:bg-neutral-900/90 backdrop-blur-xs border border-neutral-200/80 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-neutral-100 font-mono shadow-xs">
                £{(currentItem.price / 100).toFixed(2)}
              </div>
            )}

            {/* Department */}
            {currentItem.department && (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xs border border-neutral-200/80 dark:border-neutral-700 text-[10px] text-neutral-600 dark:text-neutral-300">
                {currentItem.department}
              </div>
            )}
          </div>

          {/* PRODUCT TITLE & IDENTIFIERS */}
          <div className="text-left px-0.5">
            <h3 className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100 leading-snug line-clamp-2 mb-1">
              {currentItem.name}
            </h3>

            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 font-mono">
              {currentItem.plu && <span>PLU: {currentItem.plu}</span>}
              {currentItem.gtin && currentItem.gtin[0] && (
                <span className="text-neutral-400">· GTIN: {currentItem.gtin[0].slice(-6)}</span>
              )}
            </div>

            {/* Weight notice (honest: do not fake 1.0kg) */}
            {currentItem.isWeight && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/80 dark:border-amber-800 px-2 py-1 rounded-md">
                <Scale className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                <span>
                  {currentItem.expectedWeight
                    ? `Weigh item (~${currentItem.expectedWeight}${currentItem.weightUnit || 'kg'} target)`
                    : 'Weigh item'}
                </span>
              </div>
            )}
          </div>

          {/* QUANTITY SECTION */}
          <div className="mt-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Required:</span>
              <span className="font-mono text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {totalQty} {totalQty > 1 ? 'units' : 'unit'}
              </span>
            </div>

            {/* Multi-unit indicators */}
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
                          ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-300 text-amber-800 dark:text-amber-300'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                      }`}
                      title={`Unit ${idx + 1}`}
                    >
                      {isUnitDone ? <Check className="w-3 h-3 stroke-[3]" /> : idx + 1}
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500">1 unit</span>
            )}
          </div>
        </div>
      </div>

      {/* STICKY / TOUCH-OPTIMIZED ACTION BUTTONS (Touch targets >= 48px) */}
      <div className="w-full flex items-center gap-2 mt-3 px-1">
        {/* Issue / Substitute Button */}
        <button
          type="button"
          onClick={() => triggerUnavailable(currentItem)}
          className="min-h-[48px] flex-1 px-3 rounded-lg bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 font-medium text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
          title="Item Unavailable or Substitute"
        >
          <X className="w-4 h-4 text-neutral-500" />
          <span>Can't find</span>
        </button>

        {/* Scan Barcode shortcut button */}
        {onOpenBarcodeScan && (
          <button
            type="button"
            onClick={onOpenBarcodeScan}
            className="min-h-[48px] min-w-[48px] p-2.5 rounded-lg bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 flex items-center justify-center transition active:scale-[0.98]"
            title="Scan with Camera"
          >
            <Camera className="w-4 h-4 text-neutral-500" />
          </button>
        )}

        {/* AI Vision Photo button */}
        <button
          type="button"
          onClick={onOpenPhotoPick}
          className="min-h-[48px] min-w-[48px] p-2.5 rounded-lg bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 flex items-center justify-center transition active:scale-[0.98]"
          title="Photo Recognition"
        >
          <Sparkles className="w-4 h-4 text-indigo-500" />
        </button>

        {/* Primary Pick Button (>= 48px height) */}
        <button
          type="button"
          onClick={() => triggerPickUnit(currentItem)}
          className="min-h-[48px] flex-[1.5] px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-[0.98]"
          title={isMultiQty ? `Declare Unit ${currentPicked + 1}` : 'Confirm Pick'}
        >
          <Check className="w-4 h-4 stroke-[2.5]" />
          <span>
            {isMultiQty ? `Pick unit (+1)` : 'Confirm pick'}
          </span>
        </button>
      </div>

      {/* Safe Pick All shortcut for multi-qty standalone items (guarded) */}
      {isMultiQty && (
        <div className="mt-2 text-center">
          {isSafeForPickAll ? (
            <button
              type="button"
              onClick={() => onPickUnit(currentItem, true)}
              className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition underline underline-offset-2 min-h-[32px] px-2 flex items-center mx-auto"
            >
              Pick all {remainingQty} remaining units at once
            </button>
          ) : (
            <span className="text-[11px] text-amber-700 dark:text-amber-400 italic">
              Individual verification required: {blockReasons[0]}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
