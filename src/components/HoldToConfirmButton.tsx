/**
 * @file src/components/HoldToConfirmButton.tsx
 * Touch-first guarded hold action used for potentially broad picker mutations.
 *
 * guardKey is deliberately re-read at completion time. If live order state
 * changes while the picker is holding, the action is cancelled as stale.
 */

import React, { useEffect, useRef, useState } from 'react';

interface HoldToConfirmButtonProps {
  label: React.ReactNode;
  confirmingLabel?: React.ReactNode;
  guardKey: string;
  onConfirm: () => void | Promise<void>;
  onStale?: () => void;
  disabled?: boolean;
  holdMs?: number;
  className?: string;
  title?: string;
}

export const HoldToConfirmButton: React.FC<HoldToConfirmButtonProps> = ({
  label,
  confirmingLabel = 'Keep holding…',
  guardKey,
  onConfirm,
  onStale,
  disabled = false,
  holdMs = 650,
  className = '',
  title,
}) => {
  const [holding, setHolding] = useState(false);
  const [stale, setStale] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startGuardRef = useRef<string | null>(null);
  const guardRef = useRef(guardKey);
  const confirmRef = useRef(onConfirm);
  const staleRef = useRef(onStale);

  useEffect(() => {
    guardRef.current = guardKey;
    confirmRef.current = onConfirm;
    staleRef.current = onStale;
  }, [guardKey, onConfirm, onStale]);

  const cancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startGuardRef.current = null;
    setHolding(false);
  };

  useEffect(() => cancel, []);

  const start = () => {
    if (disabled || timerRef.current) return;

    startGuardRef.current = guardRef.current;
    setHolding(true);

    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      setHolding(false);

      if (
        startGuardRef.current === null ||
        startGuardRef.current !== guardRef.current
      ) {
        startGuardRef.current = null;
        setStale(true);
        setTimeout(() => setStale(false), 1400);
        staleRef.current?.();
        return;
      }

      startGuardRef.current = null;
      await confirmRef.current();
    }, holdMs);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={typeof label === 'string' ? label : undefined}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
          event.preventDefault();
          start();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          cancel();
        }
      }}
      className={`relative overflow-hidden select-none touch-none ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-current opacity-10 pointer-events-none"
        style={{
          width: holding ? '100%' : '0%',
          transition: holding ? `width ${holdMs}ms linear` : 'width 120ms ease-out',
        }}
      />
      <span className="relative z-10">
        {stale ? 'Order changed — hold again' : holding ? confirmingLabel : label}
      </span>
    </button>
  );
};
