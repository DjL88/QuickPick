/**
 * @file src/data/commerceCatalog.ts
 * Deliverect Commerce API Catalog & Restaurant Menus.
 * Provides realistic Deliveroo / Uber Eats style stores, categorized menus,
 * meal deal bundles, modifiers, weighted produce, and dietary metadata.
 */

export interface ModifierOption {
  id: string;
  name: string;
  price: number; // in £ GBP
  isDefault?: boolean;
  calories?: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  required: boolean;
  options: ModifierOption[];
}

export interface BundleComponentGroup {
  id: string;
  name: string; // e.g., "Choose Your Main", "Select a Side", "Pick a Drink"
  role: 'COMPONENT' | 'MODIFIER' | 'CUSTOMISATION' | 'UPSELL' | 'ADD_ON';
  required: boolean;
  options: {
    plu: string;
    name: string;
    priceDelta: number; // price difference from bundle base
    imageUrl?: string;
    ageRestricted?: boolean;
    minimumAge?: number;
  }[];
}

export interface MenuItem {
  plu: string;
  name: string;
  description: string;
  price: number; // in £ GBP
  category: string;
  imageUrl: string;
  popular?: boolean;
  isBundle?: boolean;
  bundleComponents?: BundleComponentGroup[];
  modifierGroups?: ModifierGroup[];
  dietary?: ('VEGAN' | 'VEGETARIAN' | 'HALAL' | 'GLUTEN_FREE' | 'ORGANIC' | 'SPICY')[];
  isWeight?: boolean;
  weightUnit?: 'kg' | 'g';
  pricePerKg?: number;
  expectedWeight?: number;
  ageRestricted?: boolean;
  minimumAge?: number;
  department?: string;
  aisle?: string;
  shelf?: string;
  temperature?: 'AMBIENT' | 'CHILLED' | 'FROZEN';
}

export interface CommerceStore {
  id: string;
  name: string;
  tagline: string;
  category: 'RESTAURANT' | 'GROCERY' | 'BAKERY' | 'CAFE';
  cuisine: string[];
  rating: number;
  reviewCount: number;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  deliveryFee: number;
  minOrder: number;
  priceTier: '£' | '££' | '£££';
  bannerImage: string;
  logoImage: string;
  address: string;
  distanceKm: number;
  promoBadge?: string;
  dietaryBadges: string[];
  menuCategories: string[];
  items: MenuItem[];
}

export const COMMERCE_STORES: CommerceStore[] = [
  {
    id: 'store_david_victor',
    name: 'David Victor Artisanal Deli & Bakery',
    tagline: 'Artisanal sourdoughs, hand-carved pastrami, and curated European pantry goods.',
    category: 'BAKERY',
    cuisine: ['Artisanal Deli', 'Bakery', 'Sandwiches', 'Specialty Grocery'],
    rating: 4.9,
    reviewCount: 428,
    deliveryTimeMin: 20,
    deliveryTimeMax: 30,
    deliveryFee: 1.99,
    minOrder: 10,
    priceTier: '££',
    bannerImage: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1200&q=80',
    logoImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80',
    address: '142 Oxford St, London W1D 1LU',
    distanceKm: 0.8,
    promoBadge: '20% off over £25',
    dietaryBadges: ['Halal Options', 'Organic', 'Vegetarian'],
    menuCategories: [
      'Featured Deals',
      'Artisan Meal Deals',
      'Handcrafted Sandwiches',
      'Artisan Bread & Pastries',
      'Deli Charcuterie & Cheeses',
      'Beverages'
    ],
    items: [
      {
        plu: 'DV-DEAL-01',
        name: 'Artisan Lunch Meal Deal',
        description: 'Choice of handcrafted deli sandwich, artisanal sea salt crisps or side salad, and fresh cold-pressed juice or sparkling drink.',
        price: 12.50,
        category: 'Artisan Meal Deals',
        imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
        popular: true,
        isBundle: true,
        bundleComponents: [
          {
            id: 'bundle_main',
            name: 'Choose Your Main Sandwich',
            role: 'COMPONENT',
            required: true,
            options: [
              { plu: 'DV-101', name: 'New York Style Pastrami on Rye', priceDelta: 0, imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=200&q=80' },
              { plu: 'DV-102', name: 'Smoked Salmon & Dill Cream Bagel', priceDelta: 1.00, imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=200&q=80' },
              { plu: 'DV-103', name: 'Truffled Burrata & Heritage Tomato Focaccia (V)', priceDelta: 0.50, imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=200&q=80' }
            ]
          },
          {
            id: 'bundle_side',
            name: 'Select Your Side',
            role: 'COMPONENT',
            required: true,
            options: [
              { plu: 'DV-201', name: 'Rosemary & Sea Salt Hand-Cooked Crisps', priceDelta: 0 },
              { plu: 'DV-202', name: 'Wild Rocket, Shaved Parmesan & Balsamic Salad', priceDelta: 0.50 },
              { plu: 'DV-203', name: 'Truffle Parmesan Fries', priceDelta: 1.50 }
            ]
          },
          {
            id: 'bundle_drink',
            name: 'Pick Your Drink',
            role: 'COMPONENT',
            required: true,
            options: [
              { plu: 'DV-301', name: 'Organic Cold-Pressed Orange Juice (250ml)', priceDelta: 0 },
              { plu: 'DV-302', name: 'San Pellegrino Sparkling Blood Orange', priceDelta: 0 },
              { plu: 'DV-303', name: 'Craft IPA Pale Ale (330ml 5.2% ABV)', priceDelta: 1.50, ageRestricted: true, minimumAge: 18 }
            ]
          }
        ],
        dietary: ['ORGANIC'],
        department: 'Specialty & Bakery',
        aisle: 'Aisle 1',
        shelf: 'Bay 1',
        temperature: 'AMBIENT'
      },
      {
        plu: 'DV-101',
        name: 'New York Style Pastrami on Sourdough Rye',
        description: 'House-cured spiced beef brisket pastrami, melted Swiss Emmental, sweet dill pickles, and whole grain mustard on toasted sourdough rye.',
        price: 9.50,
        category: 'Handcrafted Sandwiches',
        imageUrl: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
        popular: true,
        modifierGroups: [
          {
            id: 'mod_bread',
            name: 'Bread Choice',
            minSelections: 1,
            maxSelections: 1,
            required: true,
            options: [
              { id: 'rye', name: 'Toasted Sourdough Rye', price: 0, isDefault: true },
              { id: 'focaccia', name: 'Rosemary Sea Salt Focaccia', price: 0.50 },
              { id: 'gluten_free', name: 'Gluten-Free Seeded Loaf', price: 1.00 }
            ]
          },
          {
            id: 'mod_extras',
            name: 'Customize & Add-ons',
            minSelections: 0,
            maxSelections: 4,
            required: false,
            options: [
              { id: 'extra_pastrami', name: 'Extra Pastrami (50g)', price: 2.50 },
              { id: 'extra_cheese', name: 'Extra Swiss Emmental', price: 1.20 },
              { id: 'sauce_side', name: 'Mustard on the side', price: 0 },
              { id: 'no_pickles', name: 'No Pickles', price: 0 }
            ]
          }
        ],
        dietary: ['HALAL'],
        department: 'Specialty & Bakery',
        aisle: 'Aisle 1',
        shelf: 'Bay 2',
        temperature: 'AMBIENT'
      },
      {
        plu: 'DV-103',
        name: 'Truffled Burrata & Heritage Tomato Focaccia',
        description: 'Creamy Pugliese burrata, heirloom multi-colored tomatoes, fresh basil pesto, and white truffle oil drizzle on warm Genovese focaccia.',
        price: 8.95,
        category: 'Handcrafted Sandwiches',
        imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
        dietary: ['VEGETARIAN', 'ORGANIC'],
        department: 'Specialty & Bakery',
        aisle: 'Aisle 1',
        shelf: 'Bay 3',
        temperature: 'AMBIENT'
      },
      {
        plu: 'DV-401',
        name: 'Artisan Country Sourdough Loaf (800g)',
        description: 'Slow-fermented 36-hour wild sourdough with blistered caramelised crust and airy, custard-like open crumb.',
        price: 4.80,
        category: 'Artisan Bread & Pastries',
        imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80',
        popular: true,
        dietary: ['VEGAN', 'ORGANIC'],
        department: 'Specialty & Bakery',
        aisle: 'Aisle 1',
        shelf: 'Bay 1',
        temperature: 'AMBIENT'
      },
      {
        plu: 'DV-402',
        name: 'Valrhona Dark Chocolate Hazelnut Babka Slice',
        description: 'Braided brioche ribboned with 70% Valrhona dark chocolate ganache, toasted Piedmont hazelnuts, and orange blossom syrup.',
        price: 4.20,
        category: 'Artisan Bread & Pastries',
        imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
        dietary: ['VEGETARIAN'],
        department: 'Specialty & Bakery',
        aisle: 'Aisle 1',
        shelf: 'Bay 4',
        temperature: 'AMBIENT'
      },
      {
        plu: 'DV-501',
        name: 'Aged 24-Month Parmigiano Reggiano DOP',
        description: 'Authentic mountain-crafted Parmesan with delicate crystalline crunch and deep nutty umami flavor.',
        price: 6.50,
        category: 'Deli Charcuterie & Cheeses',
        imageUrl: 'https://images.unsplash.com/photo-1452195100486-9cc805987862?auto=format&fit=crop&w=600&q=80',
        isWeight: true,
        weightUnit: 'kg',
        pricePerKg: 32.50,
        expectedWeight: 0.20,
        dietary: ['VEGETARIAN'],
        department: 'Chilled Dairy',
        aisle: 'Aisle 4',
        shelf: 'Bay 2',
        temperature: 'CHILLED'
      },
      {
        plu: 'DV-601',
        name: 'Craft IPA Pale Ale (330ml Can 5.2%)',
        description: 'Crisp, citrus-forward modern hazy pale ale dry-hopped with Citra and Mosaic.',
        price: 3.90,
        category: 'Beverages',
        imageUrl: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=600&q=80',
        ageRestricted: true,
        minimumAge: 18,
        department: 'Beverages',
        aisle: 'Aisle 3',
        shelf: 'Bay 1',
        temperature: 'AMBIENT'
      }
    ]
  },
  {
    id: 'store_ltx_grocery',
    name: 'LTx Express Grocery & Fresh Market',
    tagline: 'Farm-fresh organic produce, cold-chain dairy, artisanal snacks & pantry staples in minutes.',
    category: 'GROCERY',
    cuisine: ['Supermarket', 'Fresh Produce', 'Organic', 'Everyday Essentials'],
    rating: 4.8,
    reviewCount: 1250,
    deliveryTimeMin: 15,
    deliveryTimeMax: 25,
    deliveryFee: 1.49,
    minOrder: 15,
    priceTier: '£',
    bannerImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80',
    logoImage: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=200&q=80',
    address: '88 Deansgate, Manchester M3 2ER',
    distanceKm: 1.2,
    promoBadge: 'Free Delivery over £20',
    dietaryBadges: ['Organic', 'Vegan', 'Farm Fresh'],
    menuCategories: [
      'Fresh Fruit & Vegetables (By Weight)',
      'Dairy & Chilled Essentials',
      'Bakery & Breakfast',
      'Snacks & Confectionery',
      'Frozen Treats',
      'Drinks & Juices'
    ],
    items: [
      {
        plu: 'GROC-101',
        name: 'Organic Hass Avocados (Pack of 2)',
        description: 'Ripe and ready to eat rich creamy Peruvian Hass avocados, hand-selected for perfect guacamole.',
        price: 2.80,
        category: 'Fresh Fruit & Vegetables (By Weight)',
        imageUrl: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=600&q=80',
        popular: true,
        dietary: ['VEGAN', 'ORGANIC'],
        department: 'Produce',
        aisle: 'Aisle 1',
        shelf: 'Bay 1',
        temperature: 'AMBIENT'
      },
      {
        plu: 'GROC-102',
        name: 'Heritage Pink Lady Apples (Weighted)',
        description: 'Crunchy, sweet-tart British grown Pink Lady apples, packed with natural vitamins.',
        price: 3.20,
        category: 'Fresh Fruit & Vegetables (By Weight)',
        imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80',
        isWeight: true,
        weightUnit: 'kg',
        pricePerKg: 3.20,
        expectedWeight: 1.0,
        dietary: ['VEGAN', 'ORGANIC'],
        department: 'Produce',
        aisle: 'Aisle 1',
        shelf: 'Bay 2',
        temperature: 'AMBIENT'
      },
      {
        plu: 'GROC-103',
        name: 'Organic Whole Milk (2 Litres / 4 Pints)',
        description: 'Pasture-fed British organic unhomogenized whole milk with rich natural cream top.',
        price: 2.10,
        category: 'Dairy & Chilled Essentials',
        imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=600&q=80',
        popular: true,
        dietary: ['VEGETARIAN', 'ORGANIC'],
        department: 'Chilled Dairy',
        aisle: 'Aisle 5',
        shelf: 'Bay 1',
        temperature: 'CHILLED'
      },
      {
        plu: 'GROC-104',
        name: 'Oatly Barista Edition Oat Milk (1 Litre)',
        description: 'Foamable rich plant-based oat drink loved by baristas and coffee enthusiasts.',
        price: 2.25,
        category: 'Dairy & Chilled Essentials',
        imageUrl: 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80',
        popular: true,
        dietary: ['VEGAN'],
        department: 'Chilled Dairy',
        aisle: 'Aisle 5',
        shelf: 'Bay 3',
        temperature: 'AMBIENT'
      },
      {
        plu: 'GROC-105',
        name: 'Ben & Jerry’s Cookie Dough Ice Cream (465ml)',
        description: 'Vanilla ice cream with chunks of chocolate chip cookie dough and chocolatey chunks.',
        price: 5.50,
        category: 'Frozen Treats',
        imageUrl: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80',
        dietary: ['VEGETARIAN', 'HALAL'],
        department: 'Frozen Food',
        aisle: 'Aisle 8',
        shelf: 'Bay 2',
        temperature: 'FROZEN'
      }
    ]
  },
  {
    id: 'store_urban_smash',
    name: 'Urban Smash Burgers & Loaded Shakes',
    tagline: 'Crispy lacy-edged smashed beef patties, butter-toasted potato buns, and thick malt milkshakes.',
    category: 'RESTAURANT',
    cuisine: ['Burgers', 'American', 'Comfort Food', 'Halal'],
    rating: 4.8,
    reviewCount: 940,
    deliveryTimeMin: 20,
    deliveryTimeMax: 35,
    deliveryFee: 2.49,
    minOrder: 12,
    priceTier: '££',
    bannerImage: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=80',
    logoImage: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=200&q=80',
    address: '45 Piccadilly, London W1J 0LP',
    distanceKm: 1.5,
    promoBadge: 'Smash Combo £13.99',
    dietaryBadges: ['100% Halal Certified', 'Gluten-Free Bun Option'],
    menuCategories: [
      'Featured Deals',
      'Smash Burger Combos',
      'Signature Burgers',
      'Loaded Skinny Fries',
      'Thick Milkshakes & Sodas'
    ],
    items: [
      {
        plu: 'SMASH-DEAL-01',
        name: 'The Ultimate Double Smash Combo Meal',
        description: 'Double 3oz dry-aged beef smash burger with American cheese, choice of loaded or seasoned fries, and a handcrafted shake or soda.',
        price: 13.99,
        category: 'Smash Burger Combos',
        imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
        popular: true,
        isBundle: true,
        bundleComponents: [
          {
            id: 'smash_main',
            name: 'Choose Your Burger',
            role: 'COMPONENT',
            required: true,
            options: [
              { plu: 'SMB-01', name: 'Classic Double Cheeseburger (Pickles & House Sauce)', priceDelta: 0 },
              { plu: 'SMB-02', name: 'Truffle & Smoked Bacon Double Smash', priceDelta: 1.50 },
              { plu: 'SMB-03', name: 'Spicy Nashville Hot Chicken Burger', priceDelta: 0.50 }
            ]
          },
          {
            id: 'smash_side',
            name: 'Select Your Fries',
            role: 'COMPONENT',
            required: true,
            options: [
              { plu: 'SMF-01', name: 'Crispy Seasoned Rosemary Fries', priceDelta: 0 },
              { plu: 'SMF-02', name: 'Loaded Cheese & Jalapeño Fries', priceDelta: 1.50 },
              { plu: 'SMF-03', name: 'Sweet Potato Waffle Fries', priceDelta: 1.00 }
            ]
          },
          {
            id: 'smash_drink',
            name: 'Pick Your Beverage',
            role: 'COMPONENT',
            required: true,
            options: [
              { plu: 'SMD-01', name: 'Salted Caramel Thick Milkshake', priceDelta: 1.50 },
              { plu: 'SMD-02', name: 'Oreo Cookies & Cream Shake', priceDelta: 1.50 },
              { plu: 'SMD-03', name: 'Ice Cold Coca-Cola Zero (330ml)', priceDelta: 0 }
            ]
          }
        ],
        dietary: ['HALAL'],
        department: 'Hot Food Kitchen',
        aisle: 'Kitchen Station A',
        shelf: 'Grill 1',
        temperature: 'AMBIENT'
      },
      {
        plu: 'SMB-01',
        name: 'Classic Double Smash Cheeseburger',
        description: 'Two 3oz smashed beef patties with crispy edges, double American cheese, dill pickle coins, finely diced shallots, and house secret burger sauce on toasted potato bun.',
        price: 8.95,
        category: 'Signature Burgers',
        imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
        popular: true,
        modifierGroups: [
          {
            id: 'mod_patty',
            name: 'Patties & Protein',
            minSelections: 1,
            maxSelections: 1,
            required: true,
            options: [
              { id: 'double', name: 'Double Patty (Standard)', price: 0, isDefault: true },
              { id: 'triple', name: 'Triple Patty Smash (+£2.50)', price: 2.50 },
              { id: 'beyond', name: 'Plant-Based Beyond Patty', price: 1.00 }
            ]
          },
          {
            id: 'mod_toppings',
            name: 'Extra Toppings & Customizations',
            minSelections: 0,
            maxSelections: 5,
            required: false,
            options: [
              { id: 'bacon', name: 'Crispy Beef Bacon Strip', price: 1.80 },
              { id: 'grilled_onions', name: 'Caramelized Grilled Onions', price: 0.80 },
              { id: 'jalapenos', name: 'Pickled Jalapeños', price: 0.60 },
              { id: 'no_onions', name: 'No Onions', price: 0 },
              { id: 'no_pickles', name: 'No Pickles', price: 0 }
            ]
          }
        ],
        dietary: ['HALAL'],
        department: 'Hot Food Kitchen',
        aisle: 'Kitchen Station A',
        shelf: 'Grill 1',
        temperature: 'AMBIENT'
      },
      {
        plu: 'SMF-02',
        name: 'Loaded Cheese & Crispy Shallot Fries',
        description: 'Skin-on golden fries smothered with warm melted cheddar sauce, house secret sauce, crispy fried shallots, and sliced scallions.',
        price: 5.50,
        category: 'Loaded Skinny Fries',
        imageUrl: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=600&q=80',
        popular: true,
        dietary: ['VEGETARIAN', 'HALAL'],
        department: 'Hot Food Kitchen',
        aisle: 'Kitchen Station B',
        shelf: 'Fryer 1',
        temperature: 'AMBIENT'
      },
      {
        plu: 'SMD-01',
        name: 'Artisan Salted Caramel Malt Shake (500ml)',
        description: 'Hand-spun Madagascar vanilla gelato blended with rich Maldon sea salt caramel and whipped dairy cream.',
        price: 5.20,
        category: 'Thick Milkshakes & Sodas',
        imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80',
        popular: true,
        dietary: ['VEGETARIAN', 'HALAL'],
        department: 'Beverages',
        aisle: 'Kitchen Station C',
        shelf: 'Bar 1',
        temperature: 'CHILLED'
      }
    ]
  },
  {
    id: 'store_tokyo_ramen',
    name: 'Tokyo Ramen & Bento Izakaya',
    tagline: 'Rich 18-hour simmered Tonkotsu broth, springy handmade ramen noodles, crispy gyoza & bento boxes.',
    category: 'RESTAURANT',
    cuisine: ['Japanese', 'Ramen', 'Bento', 'Asian'],
    rating: 4.9,
    reviewCount: 780,
    deliveryTimeMin: 25,
    deliveryTimeMax: 40,
    deliveryFee: 2.99,
    minOrder: 15,
    priceTier: '££',
    bannerImage: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=80',
    logoImage: 'https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=200&q=80',
    address: '18 Brewer St, Soho, London W1F 0SJ',
    distanceKm: 1.1,
    promoBadge: 'Bento Combo Special',
    dietaryBadges: ['Authentic Japanese', 'Halal Broth Option'],
    menuCategories: [
      'Ramen Bowls',
      'Signature Bento Boxes',
      'Japanese Street Appetizers',
      'Bubble Teas & Matcha Drinks'
    ],
    items: [
      {
        plu: 'TR-101',
        name: 'Signature Tonkotsu Black Garlic Ramen',
        description: '18-hour rich silky pork broth, charred black garlic oil, slow-braised chashu, nitamago seasoned soft-boiled egg, menma bamboo shoots, and nori seaweed.',
        price: 13.50,
        category: 'Ramen Bowls',
        imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
        popular: true,
        modifierGroups: [
          {
            id: 'mod_spice',
            name: 'Spice Level',
            minSelections: 1,
            maxSelections: 1,
            required: true,
            options: [
              { id: 'spice_0', name: 'Mild / No Spice', price: 0, isDefault: true },
              { id: 'spice_1', name: 'Level 1: Medium Kick', price: 0 },
              { id: 'spice_2', name: 'Level 2: Fire Dragon (+£0.50)', price: 0.50 }
            ]
          },
          {
            id: 'mod_noodle',
            name: 'Noodle Firmness',
            minSelections: 1,
            maxSelections: 1,
            required: true,
            options: [
              { id: 'firm', name: 'Katame (Firm & Springy)', price: 0, isDefault: true },
              { id: 'regular', name: 'Futsu (Medium Regular)', price: 0 },
              { id: 'soft', name: 'Yawaraka (Soft)', price: 0 }
            ]
          }
        ],
        department: 'Hot Food Kitchen',
        aisle: 'Ramen Line',
        shelf: 'Station 1',
        temperature: 'AMBIENT'
      },
      {
        plu: 'TR-201',
        name: 'Handmade Pan-Fried Pork & Chive Gyoza (5 pcs)',
        description: 'Crispy lace-bottom dumplings filled with seasoned pork and garlic chives, served with tangy yuzu ponzu dipping sauce.',
        price: 6.20,
        category: 'Japanese Street Appetizers',
        imageUrl: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=600&q=80',
        popular: true,
        department: 'Hot Food Kitchen',
        aisle: 'Gyoza Line',
        shelf: 'Station 2',
        temperature: 'AMBIENT'
      },
      {
        plu: 'TR-301',
        name: 'Organic Uji Matcha Milk Tea with Brown Sugar Boba',
        description: 'First-harvest ceremonial green tea from Kyoto, shaken with creamy organic milk and warm slow-cooked tapioca pearls.',
        price: 4.80,
        category: 'Bubble Teas & Matcha Drinks',
        imageUrl: 'https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=600&q=80',
        popular: true,
        dietary: ['VEGETARIAN'],
        department: 'Beverages',
        aisle: 'Barista Station',
        shelf: 'Bar 2',
        temperature: 'CHILLED'
      }
    ]
  }
];

export interface CartItemOption {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  price: number;
}

export interface CartBundleSelection {
  groupId: string;
  groupName: string;
  role: 'COMPONENT' | 'MODIFIER' | 'CUSTOMISATION' | 'UPSELL' | 'ADD_ON';
  plu: string;
  name: string;
  priceDelta: number;
  imageUrl?: string;
  ageRestricted?: boolean;
}

export interface CartItem {
  id: string; // unique cart line id
  storeId: string;
  storeName: string;
  plu: string;
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string;
  category: string;
  selectedOptions: CartItemOption[];
  bundleSelections?: CartBundleSelection[];
  specialInstructions?: string;
  substitutionPolicy: 'BEST_MATCH' | 'CONTACT_ME' | 'DO_NOT_SUBSTITUTE';
  isWeight?: boolean;
  expectedWeight?: number;
  weightUnit?: string;
  ageRestricted?: boolean;
  minimumAge?: number;
  department?: string;
  aisle?: string;
  shelf?: string;
  temperature?: 'AMBIENT' | 'CHILLED' | 'FROZEN';
}
