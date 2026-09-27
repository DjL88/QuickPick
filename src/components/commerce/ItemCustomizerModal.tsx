/**
 * @file src/components/commerce/ItemCustomizerModal.tsx
 * Deliveroo & Uber Eats style item modifier & combo customizer modal.
 * Supports bundle component selection, modifier groups, dietary requests,
 * and dynamic price calculations.
 */

import React, { useState, useMemo } from 'react';
import { X, Plus, Minus, Check, Sparkles, ShieldAlert, Scale } from 'lucide-react';
import {
  MenuItem,
  CartItem,
  CartItemOption,
  CartBundleSelection,
  CommerceStore
} from '../../data/commerceCatalog.js';

interface ItemCustomizerModalProps {
  item: MenuItem;
  store: CommerceStore;
  onClose: () => void;
  onAddToCart: (cartItem: CartItem) => void;
}

export const ItemCustomizerModal: React.FC<ItemCustomizerModalProps> = ({
  item,
  store,
  onClose,
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [substitutionPolicy, setSubstitutionPolicy] = useState<'BEST_MATCH' | 'CONTACT_ME' | 'DO_NOT_SUBSTITUTE'>('BEST_MATCH');

  // Selected modifier options for standard items: groupId -> array of optionIds
  const [selectedModifierOptions, setSelectedModifierOptions] = useState<Record<string, string[]>>(() => {
    const defaults: Record<string, string[]> = {};
    if (item.modifierGroups) {
      item.modifierGroups.forEach((group) => {
        const defaultOpt = group.options.find((o) => o.isDefault) || (group.required ? group.options[0] : null);
        if (defaultOpt) {
          defaults[group.id] = [defaultOpt.id];
        } else {
          defaults[group.id] = [];
        }
      });
    }
    return defaults;
  });

  // Selected bundle options for Meal Deals / Bundles: componentGroupId -> option PLU
  const [selectedBundleOptions, setSelectedBundleOptions] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    if (item.bundleComponents) {
      item.bundleComponents.forEach((group) => {
        if (group.options.length > 0) {
          defaults[group.id] = group.options[0].plu;
        }
      });
    }
    return defaults;
  });

  // Calculate dynamic unit price including modifiers & bundle deltas
  const unitPrice = useMemo(() => {
    let total = item.price;

    // Add modifier extras
    if (item.modifierGroups) {
      item.modifierGroups.forEach((group) => {
        const selectedIds = selectedModifierOptions[group.id] || [];
        group.options.forEach((opt) => {
          if (selectedIds.includes(opt.id)) {
            total += opt.price;
          }
        });
      });
    }

    // Add bundle component price deltas
    if (item.bundleComponents) {
      item.bundleComponents.forEach((group) => {
        const selectedPlu = selectedBundleOptions[group.id];
        const opt = group.options.find((o) => o.plu === selectedPlu);
        if (opt) {
          total += opt.priceDelta;
        }
      });
    }

    return Math.max(0, total);
  }, [item, selectedModifierOptions, selectedBundleOptions]);

  const totalPrice = (unitPrice * quantity).toFixed(2);

  // Validation: are all required modifier groups satisfied?
  const isFormValid = useMemo(() => {
    if (item.modifierGroups) {
      for (const group of item.modifierGroups) {
        if (group.required) {
          const selected = selectedModifierOptions[group.id] || [];
          if (selected.length < group.minSelections) return false;
        }
      }
    }
    if (item.bundleComponents) {
      for (const group of item.bundleComponents) {
        if (group.required && !selectedBundleOptions[group.id]) return false;
      }
    }
    return true;
  }, [item, selectedModifierOptions, selectedBundleOptions]);

  const handleModifierToggle = (groupId: string, optionId: string, maxSelections: number) => {
    setSelectedModifierOptions((prev) => {
      const current = prev[groupId] || [];
      if (maxSelections === 1) {
        // Radio behavior
        return { ...prev, [groupId]: [optionId] };
      }
      // Checkbox behavior
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      } else {
        if (current.length >= maxSelections) {
          return prev; // Reached max
        }
        return { ...prev, [groupId]: [...current, optionId] };
      }
    });
  };

  const handleBundleOptionSelect = (groupId: string, plu: string) => {
    setSelectedBundleOptions((prev) => ({
      ...prev,
      [groupId]: plu,
    }));
  };

  const handleAdd = () => {
    if (!isFormValid) return;

    // Collect CartItemOptions
    const chosenOptions: CartItemOption[] = [];
    if (item.modifierGroups) {
      item.modifierGroups.forEach((group) => {
        const selectedIds = selectedModifierOptions[group.id] || [];
        group.options.forEach((opt) => {
          if (selectedIds.includes(opt.id)) {
            chosenOptions.push({
              groupId: group.id,
              groupName: group.name,
              optionId: opt.id,
              optionName: opt.name,
              price: opt.price,
            });
          }
        });
      });
    }

    // Collect CartBundleSelections
    const chosenBundle: CartBundleSelection[] = [];
    if (item.bundleComponents) {
      item.bundleComponents.forEach((group) => {
        const selectedPlu = selectedBundleOptions[group.id];
        const opt = group.options.find((o) => o.plu === selectedPlu);
        if (opt) {
          chosenBundle.push({
            groupId: group.id,
            groupName: group.name,
            role: group.role,
            plu: opt.plu,
            name: opt.name,
            priceDelta: opt.priceDelta,
            imageUrl: opt.imageUrl,
            ageRestricted: opt.ageRestricted,
          });
        }
      });
    }

    const cartItem: CartItem = {
      id: 'cart_' + Math.random().toString(36).substring(2, 9),
      storeId: store.id,
      storeName: store.name,
      plu: item.plu,
      name: item.name,
      unitPrice,
      quantity,
      imageUrl: item.imageUrl,
      category: item.category,
      selectedOptions: chosenOptions,
      bundleSelections: chosenBundle.length > 0 ? chosenBundle : undefined,
      specialInstructions: specialInstructions.trim() || undefined,
      substitutionPolicy,
      isWeight: item.isWeight,
      expectedWeight: item.expectedWeight,
      weightUnit: item.weightUnit,
      ageRestricted: item.ageRestricted,
      minimumAge: item.minimumAge,
      department: item.department,
      aisle: item.aisle,
      shelf: item.shelf,
      temperature: item.temperature,
    };

    onAddToCart(cartItem);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden text-neutral-800">
        {/* Top Header with Image */}
        <div className="relative h-48 sm:h-56 w-full shrink-0 bg-neutral-100 overflow-hidden">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors backdrop-blur-xs"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            {item.isBundle && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500 text-white flex items-center gap-1 shadow-xs">
                <Sparkles className="w-3 h-3" /> Meal Deal Combo
              </span>
            )}
            {item.ageRestricted && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-600 text-white flex items-center gap-1 shadow-xs">
                <ShieldAlert className="w-3 h-3" /> 18+ ID Required
              </span>
            )}
            {item.isWeight && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white flex items-center gap-1 shadow-xs">
                <Scale className="w-3 h-3" /> Weighted Item
              </span>
            )}
          </div>

          {/* Bottom title inside hero */}
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <h2 className="text-xl sm:text-2xl font-bold leading-tight drop-shadow-sm">{item.name}</h2>
            <p className="text-emerald-400 font-semibold text-lg drop-shadow-sm">
              £{item.price.toFixed(2)}
              {item.isWeight && item.weightUnit && (
                <span className="text-xs text-neutral-300 font-normal ml-1">
                  (approx. £{item.pricePerKg?.toFixed(2)}/{item.weightUnit})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Scrollable Customization Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {/* Description */}
          {item.description && (
            <p className="text-sm text-neutral-600 leading-relaxed">{item.description}</p>
          )}

          {/* Bundle Component Selection (QP-02 / QP-04) */}
          {item.bundleComponents && item.bundleComponents.length > 0 && (
            <div className="space-y-5 border-t border-neutral-100 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Meal Deal Selections
                </h3>
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                  Required
                </span>
              </div>

              {item.bundleComponents.map((group) => {
                const selectedPlu = selectedBundleOptions[group.id];
                return (
                  <div key={group.id} className="space-y-2 bg-neutral-50/70 p-3.5 rounded-xl border border-neutral-200/70">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-neutral-800">{group.name}</span>
                      <span className="text-xs text-neutral-500">Choose 1</span>
                    </div>

                    <div className="space-y-1.5">
                      {group.options.map((opt) => {
                        const isSelected = selectedPlu === opt.plu;
                        return (
                          <button
                            key={opt.plu}
                            type="button"
                            onClick={() => handleBundleOptionSelect(group.id, opt.plu)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left text-sm transition-all ${
                              isSelected
                                ? 'bg-emerald-50 border border-emerald-500 text-emerald-950 font-medium'
                                : 'bg-white border border-neutral-200/80 hover:border-neutral-300 text-neutral-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-neutral-300'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                              </div>
                              <span>{opt.name}</span>
                              {opt.ageRestricted && (
                                <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-semibold">
                                  18+
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-semibold text-neutral-600">
                              {opt.priceDelta > 0 ? `+£${opt.priceDelta.toFixed(2)}` : 'Included'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Modifier Groups */}
          {item.modifierGroups && item.modifierGroups.length > 0 && (
            <div className="space-y-5 border-t border-neutral-100 pt-4">
              {item.modifierGroups.map((group) => {
                const selectedIds = selectedModifierOptions[group.id] || [];
                const isSingle = group.maxSelections === 1;

                return (
                  <div key={group.id} className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-neutral-900">{group.name}</h4>
                        <p className="text-xs text-neutral-500">
                          {isSingle
                            ? group.required
                              ? 'Select 1 option (Required)'
                              : 'Select up to 1 option (Optional)'
                            : `Select up to ${group.maxSelections} options ${group.required ? '(Required)' : '(Optional)'}`}
                        </p>
                      </div>
                      {group.required && (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          Required
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {group.options.map((opt) => {
                        const isChecked = selectedIds.includes(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleModifierToggle(group.id, opt.id, group.maxSelections)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left text-sm transition-all ${
                              isChecked
                                ? 'bg-emerald-50 border border-emerald-500 text-emerald-950 font-medium'
                                : 'bg-white border border-neutral-200/80 hover:border-neutral-300 text-neutral-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-4 h-4 ${
                                  isSingle ? 'rounded-full' : 'rounded-xs'
                                } border flex items-center justify-center ${
                                  isChecked ? 'border-emerald-600 bg-emerald-600' : 'border-neutral-300'
                                }`}
                              >
                                {isChecked && <Check className="w-3 h-3 text-white stroke-[3]" />}
                              </div>
                              <span>{opt.name}</span>
                            </div>
                            <span className="text-xs font-semibold text-neutral-600">
                              {opt.price > 0 ? `+£${opt.price.toFixed(2)}` : 'Free'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Special Instructions & Dietary Notes */}
          <div className="space-y-2 border-t border-neutral-100 pt-4">
            <label className="block text-sm font-bold text-neutral-900">
              Special Instructions
            </label>
            <p className="text-xs text-neutral-500">
              Any allergies or specific prep notes (e.g. &quot;No mayo&quot;, &quot;Extra crispy&quot;, &quot;Sauce on side&quot;).
            </p>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g. Please do not include onions or pickles..."
              rows={2}
              maxLength={150}
              className="w-full text-sm p-3 rounded-xl border border-neutral-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-hidden bg-neutral-50/50 resize-none"
            />
          </div>

          {/* Deliverect Out-of-Stock Substitution Preference */}
          <div className="space-y-2 border-t border-neutral-100 pt-4">
            <label className="block text-sm font-bold text-neutral-900">
              If this item is out of stock:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSubstitutionPolicy('BEST_MATCH')}
                className={`p-2.5 rounded-xl border text-xs text-left transition-all ${
                  substitutionPolicy === 'BEST_MATCH'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold shadow-xs'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                }`}
              >
                <div className="font-bold text-neutral-900 mb-0.5">Best Match</div>
                <div className="text-[11px] text-neutral-500">Picker chooses similar item</div>
              </button>

              <button
                type="button"
                onClick={() => setSubstitutionPolicy('CONTACT_ME')}
                className={`p-2.5 rounded-xl border text-xs text-left transition-all ${
                  substitutionPolicy === 'CONTACT_ME'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold shadow-xs'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                }`}
              >
                <div className="font-bold text-neutral-900 mb-0.5">Call / Message</div>
                <div className="text-[11px] text-neutral-500">Approve substitute in app</div>
              </button>

              <button
                type="button"
                onClick={() => setSubstitutionPolicy('DO_NOT_SUBSTITUTE')}
                className={`p-2.5 rounded-xl border text-xs text-left transition-all ${
                  substitutionPolicy === 'DO_NOT_SUBSTITUTE'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold shadow-xs'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300'
                }`}
              >
                <div className="font-bold text-neutral-900 mb-0.5">Refund Item</div>
                <div className="text-[11px] text-neutral-500">Don&apos;t replace, refund me</div>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Quantity & Add to Cart */}
        <div className="p-4 bg-white border-t border-neutral-100 flex items-center gap-3 shrink-0">
          {/* Quantity Stepper */}
          <div className="flex items-center bg-neutral-100 rounded-xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 rounded-lg bg-white text-neutral-700 disabled:opacity-40 flex items-center justify-center shadow-xs hover:bg-neutral-50 transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-8 text-center font-bold text-sm text-neutral-900">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 rounded-lg bg-white text-neutral-700 flex items-center justify-center shadow-xs hover:bg-neutral-50 transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add to Cart CTA Button */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={!isFormValid}
            className={`flex-1 h-11 px-4 rounded-xl font-bold text-sm flex items-center justify-between text-white transition-all shadow-md ${
              isFormValid
                ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] cursor-pointer'
                : 'bg-neutral-300 cursor-not-allowed text-neutral-500 shadow-none'
            }`}
          >
            <span>Add to Order</span>
            <span className="bg-emerald-700/80 px-2.5 py-1 rounded-lg text-xs font-semibold">
              £{totalPrice}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
