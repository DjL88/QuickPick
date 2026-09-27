/**
 * @file src/components/PWAInstallButton.tsx
 * In-app install button compliant with AI Studio PWA guidelines.
 */

import React, { useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.js';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed standalone, hide button
  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 text-xs font-semibold hover:bg-emerald-100 transition shadow-xs active:scale-95"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install PWA</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 transition"
        >
          <Smartphone className="w-3.5 h-3.5 text-slate-600" />
          <span>Install iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 p-5 shadow-xl">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Install LTx Picker</h3>
                  <p className="text-xs text-slate-500">iOS Safari Instructions</p>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
                <p className="flex items-start gap-2">
                  <span className="font-bold text-slate-900">1.</span>
                  <span>Tap the <strong>Share</strong> button in Safari toolbar.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold text-slate-900">2.</span>
                  <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold text-slate-900">3.</span>
                  <span>Launch from your home screen for standalone picking.</span>
                </p>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-lg bg-slate-100 hover:bg-slate-200 py-2 text-xs font-semibold text-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
