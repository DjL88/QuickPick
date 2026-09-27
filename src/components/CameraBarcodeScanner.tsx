/**
 * @file src/components/CameraBarcodeScanner.tsx
 * Camera-based barcode scanner supporting native BarcodeDetector API with ZXing fallback.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, Flashlight, AlertCircle, CheckCircle, Keyboard } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { sounds } from '../lib/audio.js';
import { normalizeBarcode } from '../hooks/useHardwareScanner.js';
import { PickingItem } from '@contracts/index.js';

interface CameraBarcodeScannerProps {
  onScan: (scannedCode: string) => void;
  onClose: () => void;
  activeItem?: PickingItem;
}

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  onScan,
  onClose,
  activeItem,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [scanning, setScanning] = useState(true);

  const streamRef = useRef<MediaStream | null>(null);
  const zxingReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanIntervalRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // Check torch capability
        const track = stream.getVideoTracks()[0];
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.torch) {
          setHasTorch(true);
        }

        // Check if BarcodeDetector is natively supported
        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
          });

          scanIntervalRef.current = setInterval(async () => {
            if (!videoRef.current || !scanning) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const raw = barcodes[0].rawValue;
                handleCodeDetected(raw);
              }
            } catch {}
          }, 250);
        } else {
          // ZXing fallback
          const zxing = new BrowserMultiFormatReader();
          zxingReaderRef.current = zxing;
          zxing.decodeFromVideoDevice(
            null,
            videoRef.current!,
            (result, err) => {
              if (result && scanning) {
                handleCodeDetected(result.getText());
              }
            }
          );
        }
      } catch (err: any) {
        console.warn('Camera stream error:', err);
        setError('Camera permission denied or camera not available. Use manual input or quick scan.');
      }
    }

    initCamera();

    return () => {
      isMounted = false;
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (zxingReaderRef.current) {
        zxingReaderRef.current.reset();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleCodeDetected = (code: string) => {
    if (!code) return;
    setScanning(false);
    sounds.playScanBeep();
    onScan(code);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as any],
      });
      setTorchOn(!torchOn);
    } catch {}
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleCodeDetected(manualCode.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center">
            <Camera className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Scanner Camera</h2>
            <p className="text-[11px] text-teal-400 font-medium">BarcodeDetector + ZXing Fallback</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-lg border transition ${
                torchOn ? 'bg-amber-500/30 border-amber-400 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <Flashlight className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setShowManual(!showManual)}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white"
            title="Manual PLU / Barcode"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target Item Hint */}
      {activeItem && (
        <div className="px-4 py-2 bg-teal-950/80 border-b border-teal-800/40 flex items-center justify-between text-xs">
          <div>
            <span className="text-teal-400 font-bold">Scanning for:</span>{' '}
            <span className="text-white font-medium">{activeItem.name}</span>
          </div>
          <div className="font-mono bg-teal-900/60 px-2 py-0.5 rounded text-teal-300 text-[11px]">
            PLU: {activeItem.plu}
          </div>
        </div>
      )}

      {/* Camera Viewport & Viewfinder */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-black">
        {error ? (
          <div className="p-6 text-center max-w-sm">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <p className="text-sm text-slate-300 mb-4">{error}</p>
            {activeItem && (
              <button
                onClick={() => handleCodeDetected(activeItem.gtin?.[0] || activeItem.plu)}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 font-bold text-xs text-white shadow-lg transition"
              >
                Simulate Match ({activeItem.plu})
              </button>
            )}
          </div>
        ) : (
          <>
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />

            {/* Dark overlay with cut-out viewfinder */}
            <div className="absolute inset-0 bg-black/40 pointer-events-none" />

            {/* Viewfinder Target Box */}
            <div className="relative w-64 h-48 border-2 border-teal-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] flex items-center justify-center overflow-hidden">
              {/* Corner Accents */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-teal-300 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-teal-300 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-teal-300 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-teal-300 rounded-br-xl" />

              {/* Animated Red Laser Scan Line */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse" />

              <span className="text-[11px] text-teal-200/80 bg-black/60 px-2 py-0.5 rounded-full font-mono mt-32">
                Align barcode within box
              </span>
            </div>
          </>
        )}
      </div>

      {/* Manual Input Drawer or Quick Simulation Toolbar */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
        {showManual ? (
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Enter Barcode or PLU..."
              className="flex-1 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition"
            >
              Confirm
            </button>
          </form>
        ) : (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Quick Test Matcher:</span>
              <button
                onClick={() => setShowManual(true)}
                className="text-teal-400 hover:underline flex items-center gap-1 text-[11px]"
              >
                <Keyboard className="w-3 h-3" /> Type manual PLU
              </button>
            </div>

            {activeItem && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCodeDetected(activeItem.plu)}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition flex items-center justify-between"
                >
                  <div className="truncate pr-1">
                    <div className="text-[10px] text-slate-400 uppercase">Item PLU</div>
                    <div className="text-xs font-mono font-bold text-white">{activeItem.plu}</div>
                  </div>
                  <CheckCircle className="w-4 h-4 text-teal-400 shrink-0" />
                </button>

                {activeItem.gtin && activeItem.gtin.length > 0 ? (
                  <button
                    onClick={() => handleCodeDetected(activeItem.gtin![0])}
                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition flex items-center justify-between"
                  >
                    <div className="truncate pr-1">
                      <div className="text-[10px] text-slate-400 uppercase">Barcode GTIN</div>
                      <div className="text-xs font-mono font-bold text-teal-300 truncate">
                        {activeItem.gtin[0]}
                      </div>
                    </div>
                    <CheckCircle className="w-4 h-4 text-teal-400 shrink-0" />
                  </button>
                ) : (
                  <div className="py-2 px-3 rounded-xl bg-amber-950/40 border border-amber-800/40 text-[11px] text-amber-300 flex items-center">
                    No barcode (Use Altie AI)
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
