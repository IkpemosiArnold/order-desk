// Sample data: a made-up seafood distributor's item list and customer list.
// Species names follow common US market names (NOAA FishWatch style).
// Nothing here is a real company's catalogue, price list or customer.

/**
 * units: how the item can be ordered. cs = case, lb = pound, ea = each.
 * aliases: words that name this one item (house shorthand included).
 * unitWords: extra words that mean one of its units ("trays" for uni = each).
 */
export const items = [
  { sku: "SAL-ATL-SK", name: "Atlantic salmon fillet, skin-on", units: { cs: "10 lb case", lb: "per lb" }, aliases: ["skin-on salmon", "salmon skin-on", "salmon skin on", "atlantic salmon skin-on"] },
  { sku: "SAL-ATL-SL", name: "Atlantic salmon fillet, skinless", units: { cs: "10 lb case", lb: "per lb" }, aliases: ["skinless salmon", "salmon skinless", "atlantic salmon skinless"] },
  { sku: "SAL-ATL-WH", name: "Atlantic salmon, whole, 10-12 lb fish", units: { ea: "1 fish", cs: "3 fish" }, aliases: ["whole salmon", "salmon whole", "salmon 10-12"] },
  { sku: "SAL-KNG-FL", name: "King salmon fillet, wild", units: { lb: "per lb" }, aliases: ["king salmon", "chinook"] },
  { sku: "SAL-SOC-P6", name: "Sockeye salmon portions, 6 oz, frozen", units: { cs: "10 lb case" }, aliases: ["sockeye portions", "sockeye portion", "sockeye"] },
  { sku: "TUN-YF-SAKU", name: "Yellowfin tuna saku, #1", units: { lb: "per lb" }, aliases: ["yf saku", "yellowfin saku", "ahi saku", "yellowfin", "ahi", "yf"] },
  { sku: "TUN-BF-LOIN", name: "Bluefin tuna loin, farmed", units: { lb: "per lb" }, aliases: ["bluefin", "hon maguro"] },
  { sku: "TUN-ALB-LOIN", name: "Albacore tuna loin", units: { lb: "per lb" }, aliases: ["albacore", "albacore loin"] },
  { sku: "HAM-LOIN", name: "Hamachi (yellowtail) loin, farmed", units: { ea: "1 loin, about 3 lb", lb: "per lb" }, aliases: ["hamachi", "yellowtail"], unitWords: { ea: ["loin", "loins"] } },
  { sku: "HAL-PAC-FL", name: "Pacific halibut fillet, skin-off", units: { lb: "per lb" }, aliases: ["halibut", "fletan"] },
  { sku: "COD-PAC-FL", name: "Pacific cod fillet", units: { lb: "per lb", cs: "10 lb case" }, aliases: ["pacific cod", "cod", "bacalao"] },
  { sku: "SBL-FL", name: "Sablefish (black cod) fillet", units: { lb: "per lb" }, aliases: ["black cod", "sablefish", "butterfish"] },
  { sku: "RCK-FL", name: "Rockfish fillet, Pacific", units: { lb: "per lb" }, aliases: ["rockfish", "rock cod"] },
  { sku: "BRZ-WH", name: "Branzino, whole, 1-2 lb fish", units: { ea: "1 fish" }, aliases: ["branzino", "branzini", "lubina"], unitWords: { ea: ["fish"] } },
  { sku: "SHR-W-1620", name: "White shrimp 16/20, peeled and deveined, frozen", units: { lb: "per lb", cs: "10 lb case" }, aliases: ["16/20 shrimp", "shrimp 16/20", "camaron 16/20", "16/20"] },
  { sku: "SHR-W-2125", name: "White shrimp 21/25, peeled and deveined, frozen", units: { lb: "per lb", cs: "10 lb case" }, aliases: ["21/25 shrimp", "shrimp 21/25", "camaron 21/25", "21/25"] },
  { sku: "SCA-U10", name: "Sea scallops U10, dry", units: { lb: "per lb", cs: "10 lb case" }, aliases: ["u10 scallops", "scallops u10", "u10", "scallops", "scallop", "vieiras"] },
  { sku: "SQD-TT", name: "Squid tubes and tentacles, cleaned", units: { cs: "5 lb box x 2", lb: "per lb" }, aliases: ["squid", "calamari", "calamar", "calamares"] },
  { sku: "OYS-KUM", name: "Kumamoto oysters", units: { cs: "100 count", ea: "1 oyster" }, aliases: ["kumamoto oysters", "kumamoto", "kumamotos", "kumos", "kumo", "oysters", "oyster", "ostiones"] },
  { sku: "MUS-PEI", name: "PEI mussels", units: { cs: "10 lb bag" }, aliases: ["pei mussels", "mussels", "mejillones"], unitWords: { cs: ["bag", "bags", "bolsa", "bolsas"] } },
  { sku: "CLM-MAN", name: "Manila clams", units: { lb: "per lb", cs: "10 lb bag" }, aliases: ["manila clams", "manilas", "clams", "almejas"] },
  { sku: "CRB-DUN", name: "Dungeness crab, live", units: { lb: "per lb", ea: "1 crab, about 2 lb" }, aliases: ["dungeness", "dungie", "dungies"], unitWords: { ea: ["crab", "crabs"] } },
  { sku: "UNI-SB", name: "Uni (sea urchin), 100 g tray", units: { ea: "1 tray" }, aliases: ["uni", "sea urchin", "erizo"], unitWords: { ea: ["tray", "trays", "bandeja", "bandejas"] } },
];

/**
 * Generic words that name a group, not one item. "Salmon" alone could be
 * any of five; the reader holds the line back instead of picking one.
 */
export const families = [
  { words: ["salmon", "salmón"], skus: ["SAL-ATL-SK", "SAL-ATL-SL", "SAL-ATL-WH", "SAL-KNG-FL", "SAL-SOC-P6"], gloss: "salmon" },
  { words: ["tuna", "maguro", "atun"], skus: ["TUN-YF-SAKU", "TUN-BF-LOIN", "TUN-ALB-LOIN"], gloss: "tuna" },
  { words: ["shrimp", "camaron", "camarones"], skus: ["SHR-W-1620", "SHR-W-2125"], gloss: "shrimp" },
  { words: ["pescado blanco", "white fish", "whitefish"], skus: ["HAL-PAC-FL", "COD-PAC-FL", "RCK-FL"], gloss: "white fish" },
];

/** Customers on file. Phone numbers use the 555-01xx range kept for fiction. */
export const customers = [
  { account: "C-1042", name: "Nori House", phones: ["+1 415 555 0117"] },
  { account: "C-1187", name: "Taquería Las Olas", phones: ["+1 510 555 0162"] },
  { account: "C-0961", name: "Marlowe's Oyster Bar", phones: ["+1 415 555 0134"] },
  { account: "C-1203", name: "Bistro Fenwick", phones: ["+1 415 555 0178"] },
  { account: "C-0877", name: "Pacific Pearl", phones: ["+1 415 555 0193"] },
  { account: "C-1311", name: "Harbor and Vine", phones: ["+1 650 555 0125"] },
];

export const unitNames = { cs: "case", lb: "lb", ea: "each" };
