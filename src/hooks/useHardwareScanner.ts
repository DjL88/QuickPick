/**
 * @file src/hooks/useHardwareScanner.ts
 * Listens for hardware laser barcode scanner inputs (Zebra TC5X, Honeywell, HID scanners)
 * and normalizes barcode strings (GTIN-12, GTIN-13, EAN, PLU) by stripping leading zeros.
 */

import { useEffect, useRef } from 'react';

export function normalizeBarcode(code: string): string {
  if (!code) return '';
  const trimmed = code.trim();
  // Strip leading zeros for flexible PLU/GTIN matching
  const noZeros = trimmed.replace(/^0+/, '');
  return noZeros || trimmed;
}

export function matchesBarcode(candidate: string, query: string): boolean {
  if (!candidate || !query) return false;
  const cleanCandidate = normalizeBarcode(candidate);
  const cleanQuery = normalizeBarcode(query);
  return (
    candidate.toLowerCase() === query.toLowerCase() ||
    cleanCandidate.toLowerCase() === cleanQuery.toLowerCase()
  );
}

export function useHardwareScanner(onScan: (barcode: string) => void, enabled = true) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is currently typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Laser scanners type very fast (< 50ms between key strokes)
      if (timeDiff > 100) {
        bufferRef.current = '';
      }

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 3) {
          e.preventDefault();
          const scanned = bufferRef.current;
          bufferRef.current = '';
          onScan(scanned);
        }
      } else if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, enabled]);
}
