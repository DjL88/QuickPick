/**
 * @file src/components/SimulatorDrawer.tsx
 * Interactive developer panel for testing Deliverect webhooks, chaos monkey (429/500),
 * outbox inspection, and mock order injection.
 */

import React, { useEffect, useState } from 'react';
import {
  Cpu,
  X,
  Play,
  Copy,
  AlertTriangle,
  RotateCcw,
  Zap,
  CheckCircle,
  Clock,
  Layers,
  ShieldCheck,
  Flame,
  ArrowUpRight
} from 'lucide-react';
import { OutboxRecord } from '@contracts/index.js';
import { offlineQueue } from '../lib/offlineQueue.js';
import { sounds } from '../lib/audio.js';

interface SimulatorDrawerProps {
  onClose: () => void;
  onRefreshOrders: () => void;
}

export const SimulatorDrawer: React.FC<SimulatorDrawerProps> = ({ onClose, onRefreshOrders }) => {
  const [activeTab, setActiveTab] = useState<'webhooks' | 'chaos' | 'outbox'>('webhooks');
  const [outboxRecords, setOutboxRecords] = useState<OutboxRecord[]>([]);
  const [isInjecting, setIsInjecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Chaos controls
  const [rateLimit429, setRateLimit429] = useState(false);
  const [errorRate500, setErrorRate500] = useState(0);
  const [latencyMs, setLatencyMs] = useState(0);

  const fetchOutbox = async () => {
    try {
      const res = await fetch('/api/outbox');
      const data = await res.json();
      setOutboxRecords(data.records || []);
    } catch {}
  };

  useEffect(() => {
    fetchOutbox();
    const interval = setInterval(fetchOutbox, 2000);
    return () => clearInterval(interval);
  }, []);

  // Update mock deliverect server chaos config
  const updateChaos = async (updates: Record<string, any>) => {
    try {
      await fetch('/mock-deliverect/mock/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      setStatusMessage('Deliverect simulator configuration updated');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch {}
  };

  // 1. Inject Realistic Grocery Order Webhook
  const handleInjectOrder = async (tamperHmac = false, sendTwice = false) => {
    setIsInjecting(true);
    try {
      // First get prepared payload & valid HMAC
      const prepRes = await fetch('/api/simulator/emit-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tamperHmac }),
      });
      const prepData = await prepRes.json();

      // Now dispatch to our actual webhook endpoint POST /picking/order
      const webhookRes = await fetch('/picking/order', {
        method: 'POST',
        headers: prepData.headers,
        body: JSON.stringify(prepData.sampleOrder),
      });

      const webhookData = await webhookRes.json();

      if (sendTwice) {
        // Send exact duplicate
        const dupRes = await fetch('/picking/order', {
          method: 'POST',
          headers: prepData.headers,
          body: JSON.stringify(prepData.sampleOrder),
        });
        const dupData = await dupRes.json();
        setStatusMessage(`Duplicate sent! Server response: ${dupData.status} (deduped by sha256)`);
      } else if (tamperHmac) {
        setStatusMessage(`Tampered HMAC test: Server returned ${webhookRes.status} (${webhookData.error || 'rejected'})`);
      } else {
        setStatusMessage(`Order received! ID: ${webhookData.orderId} (Status: 200 fast)`);
        sounds.playNewOrderAlert();
      }

      onRefreshOrders();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsInjecting(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // 2. Trigger Lifecycle Webhook (e.g. Customer approved substitution)
  const handleTriggerLifecycle = async (orderId: string, eventType: string) => {
    try {
      const res = await fetch(`/picking/order/${encodeURIComponent(orderId)}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          orderId,
          timestamp: new Date().toISOString(),
          details: { approved: true, notes: 'Customer accepted via mobile push' },
        }),
      });
      const data = await res.json();
      setStatusMessage(`Lifecycle event ${eventType} delivered to /update!`);
      sounds.playPickSuccess();
      onRefreshOrders();
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    }
  };

  // 3. Flush offline queue
  const handleFlushOffline = async () => {
    const count = await offlineQueue.flush();
    setStatusMessage(`Flushed ${count} offline mutation(s) to Deliverect`);
    fetchOutbox();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-lg h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Cpu className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                Deliverect Test Harness
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold border border-slate-200">
                  Simulator
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">Webhook ingress, Outbox inspector & Chaos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-1 gap-1 text-xs">
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`flex-1 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'webhooks' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Webhooks
          </button>
          <button
            onClick={() => setActiveTab('chaos')}
            className={`flex-1 py-1.5 rounded-lg font-semibold transition ${
              activeTab === 'chaos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chaos Monkey
          </button>
          <button
            onClick={() => setActiveTab('outbox')}
            className={`flex-1 py-1.5 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'outbox' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Outbox</span>
            <span className="text-[10px] bg-slate-100 px-1.5 rounded-full font-mono font-bold text-slate-700">
              {outboxRecords.length}
            </span>
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className="mx-4 mt-2.5 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{statusMessage}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 text-xs">
          {/* TAB 1: WEBHOOKS */}
          {activeTab === 'webhooks' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                  Inbound Webhook Triggers
                </span>

                <button
                  onClick={() => handleInjectOrder(false, false)}
                  disabled={isInjecting}
                  className="w-full p-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-left transition flex items-center justify-between shadow-xs"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      🚀 Inject Retail Order (Signed HMAC)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Weighted produce, age-restricted drinks, and mixed items
                    </span>
                  </div>
                  <Play className="w-4 h-4 text-emerald-600 shrink-0" />
                </button>

                <button
                  onClick={() => handleInjectOrder(false, true)}
                  disabled={isInjecting}
                  className="w-full p-2.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-left transition flex items-center justify-between shadow-xs"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      🔁 Test Duplicate Delivery (Dedupe)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Sends identical raw body twice to verify sha256 deduplication
                    </span>
                  </div>
                  <Layers className="w-4 h-4 text-slate-500 shrink-0" />
                </button>

                <button
                  onClick={() => handleInjectOrder(true, false)}
                  disabled={isInjecting}
                  className="w-full p-2.5 rounded-lg bg-white hover:bg-slate-50 border border-rose-200 text-left transition flex items-center justify-between shadow-xs"
                >
                  <div>
                    <span className="text-xs font-bold text-rose-800 block">
                      🚫 Test Invalid HMAC Rejection (401)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Alters payload without valid HMAC key to verify security
                    </span>
                  </div>
                  <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0" />
                </button>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block">
                  Simulate Lifecycle Events
                </span>
                <p className="text-[11px] text-slate-500">
                  Emit POST /picking/order/:orderId/update events:
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleTriggerLifecycle('active', 'CUSTOMER_APPROVAL_SUBSTITUTION')}
                    className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left text-xs font-medium text-slate-900 transition"
                  >
                    <div className="text-emerald-700 font-bold mb-0.5">Approval</div>
                    <div className="text-[10px] text-slate-500 truncate">
                      CUSTOMER_APPROVAL
                    </div>
                  </button>

                  <button
                    onClick={() => handleTriggerLifecycle('active', 'PARTNER_DONE_SUCCESSFUL')}
                    className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left text-xs font-medium text-slate-900 transition"
                  >
                    <div className="text-emerald-700 font-bold mb-0.5">Success</div>
                    <div className="text-[10px] text-slate-500 truncate">
                      PARTNER_DONE
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHAOS MONKEY */}
          {activeTab === 'chaos' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Inject 429 Rate Limiting</span>
                    <span className="text-[11px] text-slate-500">
                      Deliverect returns HTTP 429 (tests backoff)
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={rateLimit429}
                    onChange={(e) => {
                      setRateLimit429(e.target.checked);
                      updateChaos({ rateLimit429: e.target.checked });
                    }}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 cursor-pointer"
                  />
                </div>

                <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Simulate 500 Server Errors</span>
                    <span className="text-[11px] text-slate-500">
                      Deliverect throws 500 (tests retries)
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={errorRate500 > 0}
                    onChange={(e) => {
                      const rate = e.target.checked ? 0.7 : 0;
                      setErrorRate500(rate);
                      updateChaos({ errorRate500: rate });
                    }}
                    className="w-4 h-4 rounded text-emerald-600 border-slate-300 cursor-pointer"
                  />
                </div>

                <div className="border-t border-slate-200 pt-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">Simulate Latency</span>
                    <span className="text-xs font-mono text-slate-600">{latencyMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2000"
                    step="200"
                    value={latencyMs}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setLatencyMs(val);
                      updateChaos({ latencyMs: val });
                    }}
                    className="w-full accent-emerald-600"
                  />
                </div>
              </div>

              {/* Offline sync */}
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-1.5">
                <span className="text-xs font-bold text-amber-900 block">Offline Queue Management</span>
                <p className="text-[11px] text-amber-800">
                  Mutations made while disconnected are queued in IndexedDB.
                </p>
                <button
                  onClick={handleFlushOffline}
                  className="w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition"
                >
                  Flush IndexedDB Queue Now
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: OUTBOX INSPECTOR */}
          {activeTab === 'outbox' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Outbox Non-Idempotent Queue
                </span>
                <button
                  onClick={fetchOutbox}
                  className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium"
                >
                  <RotateCcw className="w-3 h-3" /> Refresh
                </button>
              </div>

              {outboxRecords.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No records in outbox yet.
                </div>
              ) : (
                outboxRecords.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[11px] text-slate-900 font-bold truncate max-w-[200px]">
                        {rec.method} {rec.endpoint}
                      </div>

                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                          rec.status === 'SENT'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : rec.status === 'QUEUED'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : rec.status === 'SENDING'
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 font-mono">
                      <div>Key: {rec.idempotencyKey.slice(0, 16)}...</div>
                      <div>Attempts: {rec.attempts} / {rec.maxAttempts}</div>
                      {rec.responseStatus && (
                        <div>HTTP Response: {rec.responseStatus}</div>
                      )}
                    </div>

                    {rec.error && (
                      <div className="text-[11px] text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-200">
                        {rec.error}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
