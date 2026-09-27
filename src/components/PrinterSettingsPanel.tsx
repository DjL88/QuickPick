import React, { useEffect, useState } from 'react';
import { CheckCircle2, Printer, X } from 'lucide-react';
import { PrinterProvider, PrinterResult, PrinterTarget } from '../lib/printers.js';

interface PrinterSettingsPanelProps {
  provider: PrinterProvider;
  onClose: () => void;
}

const purposeLabel: Record<PrinterTarget['purpose'], string> = {
  RECEIPT: 'Receipt',
  TOTE_LABEL: 'Tote label',
  BAG_LABEL: 'Bag label',
};

export const PrinterSettingsPanel: React.FC<PrinterSettingsPanelProps> = ({ provider, onClose }) => {
  const [targets, setTargets] = useState<PrinterTarget[]>([]);
  const [lastResult, setLastResult] = useState<PrinterResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    provider.listPrinters().then(setTargets);
  }, [provider]);

  const runTest = async (target: PrinterTarget) => {
    setBusyId(target.id);
    const result = await provider.print({
      id: `test-${Date.now()}`,
      printerId: target.id,
      purpose: target.purpose,
      title: 'QuickPick test print',
      lines: ['QuickPick by LTx', `${purposeLabel[target.purpose]} demo`, 'No hardware command was sent.'],
    });
    setLastResult(result);
    setBusyId(null);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-sm">
      <section className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-neutral-700" />
              <h2 className="text-base font-bold text-neutral-950">Printer setup</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">
              Demo seam only. Test prints are captured in memory; QuickPick does not send ESC/POS, Bluetooth or native commands yet.
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-600" aria-label="Close printer settings">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {targets.map((target) => (
            <article key={target.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-bold text-neutral-900">{target.name}</h3>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">{purposeLabel[target.purpose]}</span>
                </div>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Transport: {target.transport.replaceAll('_', ' ').toLowerCase()} · {target.status.toLowerCase()}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === target.id || target.status !== 'AVAILABLE'}
                onClick={() => runTest(target)}
                className="min-h-11 shrink-0 rounded-xl bg-neutral-950 px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busyId === target.id ? 'Testing…' : 'Test'}
              </button>
            </article>
          ))}
        </div>

        {lastResult && (
          <div className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${lastResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`} role="status">
            {lastResult.ok && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{lastResult.message}</span>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
          Future adapters can implement this same provider contract for LAN ESC/POS printers, Bluetooth devices or a native Android/iOS bridge. Exact hardware support stays deliberately unclaimed until a device is tested.
        </div>
      </section>
    </div>
  );
};
