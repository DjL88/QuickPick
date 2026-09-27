import React from 'react';
import { Layers3, Sparkles } from 'lucide-react';
import { PickingGroup, PickingItem } from '@contracts/index.js';

interface Props {
  groups?: PickingGroup[];
  items: PickingItem[];
}

const handled = (item: PickingItem) => item.status !== 'PENDING';

const labels: Record<string, string> = {
  DEAL: 'Deal',
  BUNDLE: 'Bundle',
  MODIFIER_GROUP: 'Modifiers',
  CUSTOMISATION_GROUP: 'Custom',
  UPSELL_GROUP: 'Upsell',
  ADD_ON_GROUP: 'Add-ons',
};

export const OrderGroupRail: React.FC<Props> = ({ groups = [], items }) => {
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
          const groupItems = group.lineIds.map((id) => byId.get(id)).filter(Boolean) as PickingItem[];
          const completed = groupItems.filter(handled).length;
          return (
            <article key={group.id} className="min-w-[250px] snap-start rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                    {labels[group.type] || 'Group'}
                  </span>
                  <h3 className="mt-1 truncate text-sm font-semibold text-neutral-950">{group.label}</h3>
                </div>
                <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 font-mono text-xs font-semibold text-neutral-700">
                  {completed}/{groupItems.length}
                </span>
              </div>
              {group.instructions.length > 0 && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                  <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                  <span>{group.instructions.slice(0, 2).map((instruction) => instruction.label).join(' · ')}</span>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
