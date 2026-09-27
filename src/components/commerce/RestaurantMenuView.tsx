/**
 * @file src/components/commerce/RestaurantMenuView.tsx
 * Deliveroo & Uber Eats style store menu view.
 * Displays categorized restaurant/grocery menus, meal deal combos,
 * modifier previews, and opens customization drawer on tap.
 */

import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Star,
  Clock,
  Bike,
  Search,
  Sparkles,
  ShieldAlert,
  Scale,
  Plus,
  Tag,
  Info,
  ChevronRight
} from 'lucide-react';
import { CommerceStore, MenuItem } from '../../data/commerceCatalog.js';

interface RestaurantMenuViewProps {
  store: CommerceStore;
  onBack: () => void;
  onSelectItem: (item: MenuItem) => void;
  itemCountsInCart: Record<string, number>;
}

export const RestaurantMenuView: React.FC<RestaurantMenuViewProps> = ({
  store,
  onBack,
  onSelectItem,
  itemCountsInCart,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(store.menuCategories[0] || 'All');
  const [menuSearch, setMenuSearch] = useState('');

  // Group items by category
  const filteredItemsByCategory = useMemo(() => {
    const query = menuSearch.toLowerCase().trim();
    const result: Record<string, MenuItem[]> = {};

    store.menuCategories.forEach((cat) => {
      let items = store.items.filter((i) => i.category === cat);
      if (query) {
        items = items.filter(
          (i) => i.name.toLowerCase().includes(query) || i.description?.toLowerCase().includes(query)
        );
      }
      if (items.length > 0) {
        result[cat] = items;
      }
    });

    return result;
  }, [store, menuSearch]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      {/* Top Navigation & Store Header Banner */}
      <div className="relative rounded-3xl bg-neutral-900 text-white overflow-hidden shadow-xl border border-neutral-800">
        {/* Banner image with overlay */}
        <div className="h-44 sm:h-56 w-full relative overflow-hidden">
          <img
            src={store.bannerImage}
            alt={store.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-black/40 to-black/30" />

          {/* Back Button */}
          <button
            onClick={onBack}
            className="absolute top-4 left-4 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors backdrop-blur-xs flex items-center gap-1 text-xs font-semibold"
            aria-label="Back to all stores"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Stores</span>
          </button>
        </div>

        {/* Store Info Card Content */}
        <div className="p-5 sm:p-6 relative -mt-10 sm:-mt-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Deliverect Commerce Certified
                </span>
                {store.promoBadge && (
                  <span className="bg-rose-500 text-white px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                    <Tag className="w-3 h-3" /> {store.promoBadge}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {store.name}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-300 max-w-xl">{store.tagline}</p>
            </div>

            {/* Badges Box */}
            <div className="flex items-center gap-2 text-xs font-semibold">
              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span>{store.rating.toFixed(1)}</span>
                <span className="text-neutral-400 font-normal">({store.reviewCount})</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>{store.deliveryTimeMin}–{store.deliveryTimeMax} min</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-emerald-400" />
                <span>£{store.deliveryFee.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-400" />
        <input
          type="text"
          placeholder={`Search ${store.name} menu...`}
          value={menuSearch}
          onChange={(e) => setMenuSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-4 text-sm bg-white border border-neutral-200/90 rounded-2xl shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition-all text-neutral-800"
        />
      </div>

      {/* Sticky Menu Category Bar */}
      <div className="sticky top-14 z-20 bg-neutral-50/95 backdrop-blur-md py-2 border-b border-neutral-200/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {store.menuCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              setSelectedCategory(cat);
              const el = document.getElementById(`cat_${cat.replace(/\s+/g, '_')}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-neutral-900 text-white shadow-xs font-bold'
                : 'bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Sections List */}
      <div className="space-y-8">
        {Object.entries(filteredItemsByCategory).map(([categoryName, items]) => (
          <div
            key={categoryName}
            id={`cat_${categoryName.replace(/\s+/g, '_')}`}
            className="space-y-4 scroll-mt-28"
          >
            <div className="flex items-center justify-between border-b border-neutral-200/80 pb-2">
              <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                {categoryName.includes('Deal') && <Sparkles className="w-4 h-4 text-amber-500" />}
                {categoryName}
              </h2>
              <span className="text-xs text-neutral-500">{items.length} options</span>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item) => {
                const cartQty = itemCountsInCart[item.plu] || 0;
                const hasModifiers =
                  (item.modifierGroups && item.modifierGroups.length > 0) ||
                  (item.bundleComponents && item.bundleComponents.length > 0);

                return (
                  <div
                    key={item.plu}
                    onClick={() => onSelectItem(item)}
                    className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs hover:shadow-md hover:border-neutral-300 p-4 transition-all duration-200 cursor-pointer flex gap-3.5 justify-between group"
                  >
                    {/* Item Information */}
                    <div className="flex-1 flex flex-col justify-between space-y-2">
                      <div className="space-y-1">
                        {/* Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.isBundle && (
                            <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded">
                              Meal Deal
                            </span>
                          )}
                          {item.popular && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                              Popular
                            </span>
                          )}
                          {item.ageRestricted && (
                            <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                              <ShieldAlert className="w-3 h-3" /> 18+
                            </span>
                          )}
                          {item.isWeight && (
                            <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5">
                              <Scale className="w-3 h-3" /> By Weight
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-sm text-neutral-900 group-hover:text-emerald-700 transition-colors leading-snug">
                          {item.name}
                        </h3>
                        <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      {/* Price & Action Button */}
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <span className="font-bold text-sm text-neutral-900">
                            £{item.price.toFixed(2)}
                          </span>
                          {item.isWeight && item.weightUnit && (
                            <span className="text-[11px] text-neutral-500 ml-1 font-normal">
                              (approx. £{item.pricePerKg?.toFixed(2)}/{item.weightUnit})
                            </span>
                          )}
                        </div>

                        {/* Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectItem(item);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-xs ${
                            cartQty > 0
                              ? 'bg-emerald-600 text-white'
                              : 'bg-neutral-100 hover:bg-emerald-50 hover:text-emerald-800 text-neutral-700'
                          }`}
                        >
                          {cartQty > 0 ? (
                            <span>{cartQty} in Basket</span>
                          ) : hasModifiers ? (
                            <span>Customize +</span>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Item Thumbnail */}
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-neutral-100 overflow-hidden shrink-0 border border-neutral-100 relative">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
