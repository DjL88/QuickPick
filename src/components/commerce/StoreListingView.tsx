/**
 * @file src/components/commerce/StoreListingView.tsx
 * Deliveroo & Uber Eats style discovery and restaurant/grocery listing screen.
 * Powered by Deliverect Commerce API catalog with categorized discovery,
 * filters, meal deal highlights, and quick store entry.
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  Star,
  Clock,
  Bike,
  Sparkles,
  Tag,
  MapPin,
  ChevronRight,
  ShieldCheck,
  Flame
} from 'lucide-react';
import { CommerceStore, COMMERCE_STORES } from '../../data/commerceCatalog.js';

interface StoreListingViewProps {
  onSelectStore: (store: CommerceStore) => void;
  activeOrdersCount?: number;
  onOpenActiveOrder?: () => void;
}

export const StoreListingView: React.FC<StoreListingViewProps> = ({
  onSelectStore,
  activeOrdersCount = 0,
  onOpenActiveOrder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDietary, setSelectedDietary] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'POPULAR' | 'RATING' | 'TIME'>('POPULAR');

  const categories = [
    { id: 'ALL', label: 'All Places', emoji: '✨' },
    { id: 'BAKERY', label: 'Artisan Bakery & Deli', emoji: '🥐' },
    { id: 'GROCERY', label: 'Fresh Grocery', emoji: '🛒' },
    { id: 'RESTAURANT', label: 'Burgers & Hot Food', emoji: '🍔' },
    { id: 'DEALS', label: 'Meal Deals & Combos', emoji: '🏷️' },
  ];

  const dietaryFilters = [
    { id: 'ALL', label: 'All Diets' },
    { id: 'HALAL', label: 'Halal Certified' },
    { id: 'ORGANIC', label: 'Organic' },
    { id: 'VEGETARIAN', label: 'Vegetarian' },
  ];

  const filteredStores = useMemo(() => {
    return COMMERCE_STORES.filter((store) => {
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = store.name.toLowerCase().includes(query);
        const matchesCuisine = store.cuisine.some((c) => c.toLowerCase().includes(query));
        const matchesItem = store.items.some((i) => i.name.toLowerCase().includes(query));
        if (!matchesName && !matchesCuisine && !matchesItem) return false;
      }

      // Category filter
      if (selectedCategory === 'DEALS') {
        if (!store.items.some((i) => i.isBundle)) return false;
      } else if (selectedCategory !== 'ALL' && store.category !== selectedCategory) {
        return false;
      }

      // Dietary filter
      if (selectedDietary !== 'ALL') {
        const matchesDiet = store.dietaryBadges.some((b) => b.toUpperCase().includes(selectedDietary));
        if (!matchesDiet) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'RATING') return b.rating - a.rating;
      if (sortBy === 'TIME') return a.deliveryTimeMin - b.deliveryTimeMin;
      return b.reviewCount - a.reviewCount;
    });
  }, [searchQuery, selectedCategory, selectedDietary, sortBy]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Top Banner & Active Order Notification */}
      {activeOrdersCount > 0 && (
        <div
          onClick={onOpenActiveOrder}
          className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-md hover:shadow-lg cursor-pointer transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              <Bike className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                Live Deliverect Order in Progress
              </div>
              <div className="text-sm font-semibold">
                Your order is being picked & prepared. Tap to track live status →
              </div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/80 shrink-0" />
        </div>
      )}

      {/* Hero Welcome Promo */}
      <div className="relative rounded-3xl bg-neutral-900 text-white overflow-hidden p-6 sm:p-8 shadow-xl border border-neutral-800">
        <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
        <div className="relative z-10 max-w-xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            Powered by Deliverect Commerce API
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            Order from London&apos;s best artisanal kitchens & markets.
          </h1>
          <p className="text-sm text-neutral-300 leading-relaxed">
            From David Victor fresh pastrami & sourdough deals to fast local grocers — straight to your door in 20–30 minutes.
          </p>
        </div>
      </div>

      {/* Search & Address Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search stores, dishes, meal deals (e.g. Pastrami, Avocados, Ramen)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 text-sm bg-white border border-neutral-200/90 rounded-2xl shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden transition-all text-neutral-800"
          />
        </div>

        {/* Sort & Dietary Dropdown */}
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-11 px-3 text-xs font-semibold bg-white border border-neutral-200/90 rounded-2xl text-neutral-700 focus:ring-1 focus:ring-emerald-500 outline-hidden cursor-pointer"
          >
            <option value="POPULAR">Most Popular</option>
            <option value="RATING">Highest Rated (4.8★+)</option>
            <option value="TIME">Fastest Delivery (&lt;25m)</option>
          </select>
        </div>
      </div>

      {/* Category Pills Carousel */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCategory === cat.id
                ? 'bg-neutral-900 text-white shadow-xs font-bold'
                : 'bg-white text-neutral-700 border border-neutral-200/80 hover:border-neutral-300'
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Dietary Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {dietaryFilters.map((diet) => (
          <button
            key={diet.id}
            type="button"
            onClick={() => setSelectedDietary(diet.id)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              selectedDietary === diet.id
                ? 'bg-emerald-50 text-emerald-800 font-semibold border border-emerald-300'
                : 'bg-white text-neutral-500 border border-neutral-200 hover:text-neutral-800'
            }`}
          >
            {diet.label}
          </button>
        ))}
      </div>

      {/* Store Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900">
            {selectedCategory === 'ALL' ? 'All Featured Places' : `${filteredStores.length} Places Found`}
          </h2>
          <span className="text-xs text-neutral-500">{filteredStores.length} stores delivering now</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredStores.map((store) => (
            <div
              key={store.id}
              onClick={() => onSelectStore(store)}
              className="group bg-white rounded-2xl border border-neutral-200/80 shadow-xs hover:shadow-md hover:border-neutral-300 transition-all duration-200 overflow-hidden cursor-pointer flex flex-col"
            >
              {/* Cover Image & Promos */}
              <div className="relative h-44 w-full bg-neutral-100 overflow-hidden">
                <img
                  src={store.bannerImage}
                  alt={store.name}
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                {/* Promo Badge */}
                {store.promoBadge && (
                  <div className="absolute top-3 left-3 bg-rose-600 text-white px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm">
                    <Tag className="w-3 h-3" />
                    {store.promoBadge}
                  </div>
                )}

                {/* Delivery Time Badge */}
                <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs text-neutral-900 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  {store.deliveryTimeMin}–{store.deliveryTimeMax} min
                </div>

                {/* Rating Badge */}
                <div className="absolute bottom-3 left-3 bg-neutral-900/90 text-white px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span>{store.rating.toFixed(1)}</span>
                  <span className="text-neutral-400 font-normal">({store.reviewCount})</span>
                </div>
              </div>

              {/* Store Details Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-neutral-900 group-hover:text-emerald-700 transition-colors">
                      {store.name}
                    </h3>
                    <span className="text-xs font-semibold text-neutral-400">{store.priceTier}</span>
                  </div>
                  <p className="text-xs text-neutral-500 line-clamp-1">{store.tagline}</p>
                </div>

                {/* Cuisine Tags & Delivery Fee */}
                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 text-xs text-neutral-600">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {store.cuisine.slice(0, 2).map((c, idx) => (
                      <span key={idx} className="bg-neutral-100 px-2 py-0.5 rounded-md text-[11px] font-medium">
                        {c}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 font-semibold text-neutral-800">
                    <Bike className="w-3.5 h-3.5 text-emerald-600" />
                    <span>£{store.deliveryFee.toFixed(2)} delivery</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
