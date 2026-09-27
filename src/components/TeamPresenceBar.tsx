/**
 * @file src/components/TeamPresenceBar.tsx
 * Live multi-user presence: displays store team members, current picking aisles,
 * and shared picking indicators with clean lines and calm typography.
 */

import React from 'react';
import { Store, ChevronDown } from 'lucide-react';
import { PickerUser } from '@contracts/index.js';

interface TeamPresenceBarProps {
  currentUser: PickerUser;
  activePickers: PickerUser[];
  onSwitchUser: (user: PickerUser) => void;
  onOpenStoreSelector: () => void;
}

export const TeamPresenceBar: React.FC<TeamPresenceBarProps> = ({
  currentUser,
  activePickers,
  onSwitchUser,
  onOpenStoreSelector,
}) => {
  return (
    <div className="px-4 py-1.5 bg-neutral-50/80 border-b border-neutral-200/60 flex items-center justify-between text-xs text-neutral-600">
      {/* Store Location */}
      <button
        onClick={onOpenStoreSelector}
        className="flex items-center gap-1.5 text-neutral-600 hover:text-neutral-900 transition font-medium"
      >
        <Store className="w-3.5 h-3.5 text-neutral-400" />
        <span className="truncate max-w-[140px] sm:max-w-none">
          {currentUser.storeName}
        </span>
        <ChevronDown className="w-3 h-3 text-neutral-400" />
      </button>

      {/* Team Presence avatars & picker name */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-neutral-400 hidden sm:inline">
          Picker: <span className="font-medium text-neutral-700">{currentUser.name}</span>
        </span>
        <div className="flex items-center -space-x-1">
          {activePickers.slice(0, 4).map((picker) => (
            <div
              key={picker.id}
              title={`${picker.name} • ${picker.currentAisle || 'Active'}`}
              className={`w-5 h-5 rounded-full border border-white flex items-center justify-center text-[10px] font-medium text-white transition cursor-pointer ${
                picker.id === currentUser.id
                  ? 'bg-emerald-600'
                  : 'bg-neutral-400 hover:bg-neutral-500'
              }`}
              onClick={() => onSwitchUser(picker)}
            >
              {picker.name.charAt(0)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
