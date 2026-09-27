import React from 'react';
import { Check, Layers3, ShieldAlert } from 'lucide-react';
import { getGroupPickAllDecision, PickingGroup, PickingItem } from '@contracts/index.js';

interface Props {
  groups?: PickingGroup[];
  items: PickingItem[];
  onPickAll: (group: PickingGroup, lineIds: string[]) => void;
}

const done = (item: PickingItem) =>
  item.status === 'PICKED' || item.status === 'REPLACED' || item.status === 'REMOVED';

const labels: Record<string, string> = {
  DEAL: 'Deal',
  BUNDLE: 'Bundle',
  MODIFIER_GROUP: 'Modifiers',
  CUSTOMISATION_GROUP: 'Custom',
  UPSELL_GROUP: 'Upsell',
  ADD_ON_GROUP: 'Add-ons',
};

export const OrderGroupRail: React.FC<Props> = ({ groups = [], items, onPickAll }) => {
  if (!groups.length) return null;
  const byId = new Map(items.map((item) => [item._id, item]));

  return (
    <section aria-label="Grouped item progress" className="space-y-2">
      <div className="flex items-center gap-2 px-0.5">
        <Layers3 className="h-4 w-4 text-violet-600" />
        <h2 className="text-xs font-semibold text-neutral-900">Bundles & extras</h2>
      </div>
      <div className="flex snap-x gap-2 overflow-x-auto pb-1">
        {groups.map((group) => {
          const decision = getGroupPickAllDecision(group, items);
          const groupItems = group.lineIds.map((id) => byId.get(id)).filter(Boolean) as PickingItem[];
          const completed = groupItems.filter(done).length;
          const pct = groupItems.length ? Math.round((completed / groupItems.length) * 100) : 0;
          return (
            <article key={group.id} className="min-w-[280px] snap-start rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-violet-700">
                    <span className="rounded-full bg-violet-50 px-2 py-0.5">{labels[group.type] || 'Group'}</span>
                    <span className="font-mono text-neutral-500">{completed}/{groupItems.length}</span>
                  </div>
                  <h3 className="truncate text-sm font-semibold text-neutral-950">{group.label}</h3>
                </div>
                <span className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-bold text-neutral-700">{pct}%</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: pct + '%' }} />
              </div>
              {group.instructions.length > 0 && (
                <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                  {group.instructions.slice(0, 2).map((i) => i.label).join(' · ')}
                </div>
              )}
              <div className="mt-3">
                {decision.eligible ? (
                  <button
                    type="button"
                    onClick={() => onPickAll(group, decision.eligibleLineIds)}
                    className="min-h-12 w-full rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white active:scale-[0.98]"
                  >
                    <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" />Pick all {decision.eligibleLineIds.length}</span>
                  </button>
                ) : (
                  <div className="min-h-12 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-600">
                    <div className="flex items-center gap-1.5 font-semibold text-neutral-800"><ShieldAlert className="h-3.5 w-3.5 text-amber-600" />Individual checks required</div>
                    <div>{decision.blocked.length} line{decision.blocked.length === 1 ? '' : 's'} need scan, weight, age, substitution or explicit verification.</div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
