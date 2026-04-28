# eBay Leaf Categories — Flippd v5.2

This document lists all 21 eBay leaf categories hardcoded into the AI Listing Generator (EBAY_LEAF_CATEGORIES constant in Flippd_v5.html).

These categories were extracted from the user's actual eBay listings file (`eBay-edit-price-quantity-template-2026-04-27-13297587584.csv`) on April 27, 2026.

---

## All 21 Categories (with eBay Category IDs)

| # | Category | eBay ID | Used in CSV Export |
|---|----------|---------|-------------------|
| 1 | Light Bulbs & LEDs | 172517 | Yes |
| 2 | Sculptures & Figurines | 261628 | Yes |
| 3 | Display Cases & Stands | 171135 | Yes |
| 4 | Security Cameras | 48638 | Yes |
| 5 | Printers | 1245 | Yes |
| 6 | Storage Bags & Preservation | 175631 | Yes |
| 7 | Controllers & Attachments | 117042 | Yes |
| 8 | RC Tools & Sets | 68407 | Yes |
| 9 | Amplifiers & Preamps | 14970 | Yes |
| 10 | Tire Pressure Monitoring Sensor | 179696 | Yes |
| 11 | Additional Wiper & Washer Components | 262179 | Yes |
| 12 | Mini Fridges | 71262 | Yes |
| 13 | Autoharps & Zithers | 181261 | Yes |
| 14 | Chargers & Cradles | 162046 | Yes |
| 15 | CD, DVD & Blu-ray Duplicators | 31509 | Yes |
| 16 | Tiles | 261630 | Yes |
| 17 | Plaques & Signs | 31587 | Yes |
| 18 | Marine Audio | 168105 | Yes |
| 19 | Modems | 58297 | Yes |
| 20 | Hair Dryers | 11858 | Yes |
| 21 | Wireless Routers | 44995 | Yes |

---

## Condition ID Mapping

When exporting to eBay CSV, item conditions are mapped to eBay condition IDs:

| App Condition | eBay Condition ID | Description |
|--------------|------------------|-------------|
| New | NEW | Brand new, never used |
| Like New | LIKE_NEW | Appears unused, mint condition |
| Open Box | OPEN_BOX | Opened but not used |
| Used | USED_VERY_GOOD | Minor signs of use |
| Fair | USED_ACCEPTABLE | Shows use, may have cosmetic issues |

---

## How These Categories Are Used

### In Inventory Screen
When a user clicks the "🚀 Listing" button on an item, the modal displays a dropdown with all 21 categories. The user selects the leaf category that best matches the item.

### In CSV Export
When exporting items to eBay CSV format:
1. The app reads `item.listing.ebayCategory` (e.g., "Light Bulbs & LEDs")
2. Looks up the category ID in `EBAY_LEAF_CATEGORIES` (e.g., 172517)
3. Includes the ID in the CSV "Category ID" column
4. eBay Seller Hub accepts the CSV and creates draft listings in the correct category

---

## If You Need to Update Categories

If the user's eBay category mix changes, extract the categories from their current eBay listings:

1. Go to eBay Seller Hub > Selling > Active Listings
2. Export the listing data (or copy from seller's tool export)
3. Extract unique categories and their eBay category IDs
4. Update the `EBAY_LEAF_CATEGORIES` object in Flippd_v5.html
5. Update this document

**Do not use broad categories** (e.g., "Electronics") — eBay requires leaf categories. If unsure, look up the category ID in eBay's category browser.

---

## Source Data

- **Extracted from:** `/mnt/user-data/uploads/eBay-edit-price-quantity-template-2026-04-27-13297587584.csv`
- **Date extracted:** April 27, 2026
- **Method:** Parsed CSV, extracted unique `Category Name` and `Category ID` pairs from active listings
- **Validation:** All category IDs verified against eBay's category hierarchy (leaf categories only, no parent categories)

---

## Notes for Developers

- **Never use hardcoded condition strings** — use the EBAY_CONDITION_IDS mapping instead
- **CSV export function** (`exportListingsToCSV()`) reads from this mapping to populate the Condition ID column
- **User-facing UI** shows friendly category names (e.g., "Light Bulbs & LEDs"), not IDs
- **Error handling:** If a category isn't found in EBAY_LEAF_CATEGORIES, the export will show an empty category ID — this will cause eBay to reject the CSV. Always validate categories before export.
