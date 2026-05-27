// 21 eBay top-level categories with official category IDs

export interface EbayCategory {
  id: string;
  name: string;
}

export const EBAY_CATEGORIES: EbayCategory[] = [
  { id: "293",   name: "Consumer Electronics" },
  { id: "11450", name: "Clothing, Shoes & Accessories" },
  { id: "888",   name: "Sporting Goods" },
  { id: "220",   name: "Toys & Hobbies" },
  { id: "1",     name: "Collectibles" },
  { id: "11700", name: "Home & Garden" },
  { id: "6000",  name: "eBay Motors" },
  { id: "267",   name: "Books" },
  { id: "11233", name: "Music" },
  { id: "11232", name: "Movies & TV" },
  { id: "1249",  name: "Video Games & Consoles" },
  { id: "58058", name: "Computers, Tablets & Networking" },
  { id: "15032", name: "Cell Phones & Accessories" },
  { id: "625",   name: "Cameras & Photography" },
  { id: "619",   name: "Musical Instruments & Gear" },
  { id: "12576", name: "Business & Industrial" },
  { id: "550",   name: "Art" },
  { id: "20081", name: "Antiques" },
  { id: "281",   name: "Jewelry & Watches" },
  { id: "2984",  name: "Baby" },
  { id: "11116", name: "Entertainment Memorabilia" },
];

export const EBAY_CATEGORY_MAP: Record<string, EbayCategory> = Object.fromEntries(
  EBAY_CATEGORIES.map((c) => [c.id, c])
);
