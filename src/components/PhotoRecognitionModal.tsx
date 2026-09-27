/**
 * @file src/components/PhotoRecognitionModal.tsx
 * Altie AI Vision: Photograph the product to pick with photo recognition
 * when barcodes are missing, torn, or obscured.
 */

import React, { useRef, useState } from 'react';
import { Camera, Sparkles, Check, X, RefreshCw, AlertCircle } from 'lucide-react';
import { PickingItem } from '@contracts/index.js';
import { sounds } from '../lib/audio.js';

interface PhotoRecognitionModalProps {
  orderId: string;
  candidateItems: PickingItem[];
  onMatched: (item: PickingItem) => void;
  onClose: () => void;
}

export const PhotoRecognitionModal: React.FC<PhotoRecognitionModalProps> = ({
  orderId,
  candidateItems,
  onMatched,
  onClose,
}) => {
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matchResult, setMatchResult] = useState<{
    itemId: string;
    name: string;
    plu: string;
    confidence: number;
    reason: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPhotoData(base64);
      analyzePhoto(base64);
    };
    reader.readAsDataURL(file);
  };

  const analyzePhoto = async (base64: string) => {
    setIsAnalyzing(true);
    setError(null);
    setMatchResult(null);

    try {
      const res = await fetch('/api/altie/photo-recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          photoBase64: base64,
          candidateItems: candidateItems.filter((i) => i.status === 'PENDING'),
        }),
      });

      if (!res.ok) {
        throw new Error('Altie Vision service temporary unavailable');
      }

      const data = await res.json();
      if (data.matchedItem) {
        setMatchResult(data.matchedItem);
        sounds.playScanBeep();
      } else {
        setError(data.message || 'No candidate matching this image was identified');
        sounds.playErrorBuzz();
      }
    } catch (err: any) {
      setError(err.message || 'Vision recognition failed');
      sounds.playErrorBuzz();
    } finally {
      setIsAnalyzing(false);
    }
  };

  const confirmMatch = () => {
    if (!matchResult) return;
    const item = candidateItems.find((i) => i._id === matchResult.itemId);
    if (item) {
      sounds.playPickSuccess();
      onMatched(item);
    }
  };

  const simulatePhotoPick = (item: PickingItem) => {
    const sampleImg = item.imageUrl || 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400';
    setPhotoData(sampleImg);
    setMatchResult({
      itemId: item._id,
      name: item.name,
      plu: item.plu,
      confidence: 0.96,
      reason: `Matched packaging & visual characteristics for ${item.name}`,
    });
    sounds.playScanBeep();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Altie AI Photo Pick</h3>
              <p className="text-[11px] text-slate-500">Identify products without barcodes</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-3 text-xs">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCapture}
          />

          {photoData ? (
            <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-video flex items-center justify-center">
              <img src={photoData} alt="Product snap" className="w-full h-full object-cover" />

              {isAnalyzing && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center text-center p-4">
                  <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin mb-2" />
                  <p className="text-xs font-bold text-slate-900">Analyzing visual patterns...</p>
                  <p className="text-[11px] text-slate-500">Matching produce shapes & packaging</p>
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border-2 border-dashed border-slate-200 hover:border-slate-300 bg-slate-50 p-6 text-center cursor-pointer transition group"
            >
              <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition shadow-xs">
                <Camera className="w-5 h-5 text-slate-600" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 mb-0.5">Take or Upload Product Photo</h4>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                Altie matches produce or unlabeled items to the order.
              </p>
            </div>
          )}

          {/* Match Result Card */}
          {matchResult && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                    Product Identified
                  </span>
                  <h4 className="text-xs font-bold text-slate-900">{matchResult.name}</h4>
                  <p className="text-[11px] font-mono text-slate-600">PLU: {matchResult.plu}</p>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                    {Math.round(matchResult.confidence * 100)}% Match
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-600 bg-white p-2 rounded border border-emerald-200">
                "{matchResult.reason}"
              </p>

              <button
                onClick={confirmMatch}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition active:scale-98"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                Confirm Pick via Photo
              </button>
            </div>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick simulation pills */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[11px] text-slate-500 font-medium mb-1.5">Simulate photo for testing:</p>
            <div className="flex flex-wrap gap-1.5">
              {candidateItems
                .filter((i) => i.status === 'PENDING')
                .slice(0, 3)
                .map((item) => (
                  <button
                    key={item._id}
                    onClick={() => simulatePhotoPick(item)}
                    className="text-[11px] px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 transition"
                  >
                    <span>📸</span>
                    <span className="truncate max-w-[120px]">{item.name}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between">
          {photoData && (
            <button
              onClick={() => {
                setPhotoData(null);
                setMatchResult(null);
                fileInputRef.current?.click();
              }}
              className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Retake Photo
            </button>
          )}

          <button
            onClick={onClose}
            className="ml-auto px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
