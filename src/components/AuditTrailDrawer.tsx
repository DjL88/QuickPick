/**
 * @file src/components/AuditTrailDrawer.tsx
 * Drawer displaying order audit trail and execution timestamps.
 */

import React from 'react';
import { History, X, ShieldCheck, Clock, User, ArrowRight } from 'lucide-react';
import { AuditLogEntry } from '@contracts/index.js';

interface AuditTrailDrawerProps {
  logs: AuditLogEntry[];
  orderId: string;
  onClose: () => void;
}

export const AuditTrailDrawer: React.FC<AuditTrailDrawerProps> = ({ logs, orderId, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-md h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Order Audit Trail</h3>
              <p className="text-[11px] text-slate-500 font-mono">{orderId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2 text-xs">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No audit records recorded yet.
            </div>
          ) : (
            logs.map((log) => {
              const timeStr = new Date(log.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              return (
                <div
                  key={log.id}
                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{log.action}</span>
                    <span className="font-mono text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeStr}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-600">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      <strong className="text-slate-700">{log.actor}</strong>
                    </span>
                  </div>

                  {log.details && Object.keys(log.details).length > 0 && (
                    <pre className="text-[10px] font-mono bg-white p-2 rounded border border-slate-200 text-slate-600 overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
