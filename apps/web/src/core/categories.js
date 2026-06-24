/**
 * Category constants and utilities.
 * Single source of truth for all category-related data.
 */

export const CATEGORIES = [
  'Electronics', 'Clothing', 'Shoes', 'Home & Garden', 'Collectibles',
  'Toys & Hobbies', 'Sporting Goods', 'Books', 'Automotive',
  'Health & Beauty', 'Tools', 'Musical Instruments', 'Pet Supplies',
  'Baby', 'Jewelry & Watches',
];

export const PLATFORMS  = ['eBay', 'Poshmark', 'Mercari', 'FB Marketplace', 'Multiple'];
export const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Poor'];
export const STATUSES   = ['Unlisted', 'Listed', 'Sold'];

export const CAT_ICONS = {
  Electronics: '🖥️', Clothing: '👕', Shoes: '👟', 'Home & Garden': '🏡',
  Collectibles: '🏆', 'Toys & Hobbies': '🎮', 'Sporting Goods': '⚽',
  Books: '📚', Automotive: '🚗', 'Health & Beauty': '💄', Tools: '🔧',
  'Musical Instruments': '🎸', 'Pet Supplies': '🐾', Baby: '🍼',
  'Jewelry & Watches': '💍',
};

export const SKU_PREFIXES = {
  Electronics: 'ELC', Clothing: 'CLO', Shoes: 'SHO', 'Home & Garden': 'HMG',
  Collectibles: 'COL', 'Toys & Hobbies': 'TOY', 'Sporting Goods': 'SPT',
  Books: 'BOK', Automotive: 'AUT', 'Health & Beauty': 'HLT', Tools: 'TLS',
  'Musical Instruments': 'MUS', 'Pet Supplies': 'PET', Baby: 'BBY',
  'Jewelry & Watches': 'JWL',
};

/** eBay leaf category IDs keyed by our internal category names. */
export const EBAY_LEAF_CATEGORIES = {
  Electronics: 58058, Clothing: 15724, Shoes: 63889, 'Home & Garden': 11700,
  Collectibles: 1, 'Toys & Hobbies': 220, 'Sporting Goods': 888,
  Books: 267, Automotive: 6000, 'Health & Beauty': 26395, Tools: 631,
  'Musical Instruments': 619, 'Pet Supplies': 1281, Baby: 2984,
  'Jewelry & Watches': 281,
};

/** eBay condition IDs by our display condition string. */
export const EBAY_CONDITION_IDS = {
  New: 1000, 'Like New': 1500, 'Open Box': 1500, Good: 3000,
  Used: 3000, Fair: 5000, Poor: 6000,
};

/**
 * Migration map for old category names → current names.
 * Handles the Home Goods → Home & Garden rename.
 */
const CAT_MIGRATE = {
  'Home Goods': 'Home & Garden',
};

/**
 * @param {string} cat
 * @returns {string}
 */
export function migrateCategory(cat) {
  return CAT_MIGRATE[cat] ?? cat;
}

/**
 * Map an AI-returned free-text category to our canonical list.
 * Falls back to 'Electronics' if no match found.
 * @param {string} aiCat
 * @returns {string}
 */
export function mapToInvCategory(aiCat) {
  if (!aiCat) return 'Electronics';
  const lower = aiCat.toLowerCase();

  const exact = CATEGORIES.find(c => c.toLowerCase() === lower);
  if (exact) return exact;

  const map = {
    electronic: 'Electronics', tech: 'Electronics', computer: 'Electronics',
    phone: 'Electronics', camera: 'Electronics', audio: 'Electronics',
    video: 'Electronics', gaming: 'Electronics', game: 'Toys & Hobbies',
    toy: 'Toys & Hobbies', sport: 'Sporting Goods', fitness: 'Sporting Goods',
    cloth: 'Clothing', shirt: 'Clothing', pant: 'Clothing', dress: 'Clothing',
    shoe: 'Shoes', boot: 'Shoes', sneaker: 'Shoes', home: 'Home & Garden',
    kitchen: 'Home & Garden', garden: 'Home & Garden', furniture: 'Home & Garden',
    book: 'Books', media: 'Books', music: 'Musical Instruments',
    instrument: 'Musical Instruments', guitar: 'Musical Instruments',
    auto: 'Automotive', car: 'Automotive', vehicle: 'Automotive',
    health: 'Health & Beauty', beauty: 'Health & Beauty', cosmetic: 'Health & Beauty',
    tool: 'Tools', hardware: 'Tools', power: 'Tools',
    collect: 'Collectibles', antique: 'Collectibles', vintage: 'Collectibles',
    pet: 'Pet Supplies', animal: 'Pet Supplies',
    baby: 'Baby', infant: 'Baby', toddler: 'Baby',
    jewel: 'Jewelry & Watches', watch: 'Jewelry & Watches', ring: 'Jewelry & Watches',
  };

  const match = Object.entries(map).find(([k]) => lower.includes(k));
  return match ? match[1] : 'Electronics';
}

/**
 * Return the eBay category ID for an inventory item.
 * @param {{ category: string, notes?: string }} item
 * @returns {number}
 */
export function getEbayCatId(item) {
  return EBAY_LEAF_CATEGORIES[item.category] ?? 58058;
}
