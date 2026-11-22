import {itemCategory} from "./categories.js";
export const MODULE_ID = "npc-shops";
export const COINS = Object.freeze({pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1});
export const PRICE_COINS = Object.freeze({pp: 1000, gp: 100, sp: 10, cp: 1});
export const PRICE_DENOMINATIONS = Object.freeze(Object.keys(PRICE_COINS));
export const SALEABLE_TYPES = new Set(["weapon", "equipment", "consumable", "tool", "loot", "container"]);
const denominations = Object.keys(COINS);

export function assertInt(value, min = 0, max = 999999) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`Invalid quantity: ${value}`);
  return n;
}
export function walletCoins(wallet = {}) {
  const result = {};
  for (const coin of denominations) {
    // v11 and v14 standard dnd5e actors use integer currency denomination fields.
    const value = wallet?.[coin] ?? 0;
    result[coin] = assertInt(value, 0, Number.MAX_SAFE_INTEGER);
  }
  return result;
}
export function moneyTotal(wallet = {}) {
  const coins = walletCoins(wallet);
  const total = denominations.reduce((sum, c) => sum + coins[c] * COINS[c], 0);
  if (!Number.isSafeInteger(total)) throw new Error("Coin balance exceeds safe limits");
  return total;
}
export function moneyBreakdown(total) {
  total = assertInt(total, 0, Number.MAX_SAFE_INTEGER);
  const result = {};
  for (const [coin, factor] of Object.entries(COINS)) {
    result[coin] = Math.floor(total / factor);
    total %= factor;
  }
  return result;
}

/** Pay exact value without consolidating the character's gold into platinum. */
export function spendCoins(wallet, costCp) {
  costCp = assertInt(costCp, 0, Number.MAX_SAFE_INTEGER);
  if (moneyTotal(wallet) < costCp) throw new Error("Insufficient funds");
  const result = walletCoins(wallet);
  let remaining = costCp;
  // Spend GP first, then smaller denominations, and PP only when really needed.
  for (const coin of ["gp", "ep", "sp", "cp", "pp"]) {
    const count = Math.min(result[coin], Math.floor(remaining / COINS[coin]));
    result[coin] -= count;
    remaining -= count * COINS[coin];
  }
  if (remaining) {
    // Break the smallest remaining coin capable of covering the difference.
    const toBreak = ["sp", "ep", "gp", "pp"].find(c => result[c] && COINS[c] > remaining);
    if (!toBreak) throw new Error("Unable to make change");
    result[toBreak]--;
    let change = COINS[toBreak] - remaining;
    for (const coin of denominations.filter(c => COINS[c] < COINS[toBreak])) {
      const count = Math.floor(change / COINS[coin]);
      result[coin] += count;
      change -= count * COINS[coin];
    }
    if (change) throw new Error("Unable to return exact change");
  }
  if (moneyTotal(result) !== moneyTotal(wallet) - costCp) throw new Error("Currency reconciliation failed");
  return result;
}

/** Credit GP/SP/CP directly. Never transform existing GP into platinum. */
export function addCoins(wallet, amountCp) {
  amountCp = assertInt(amountCp, 0, Number.MAX_SAFE_INTEGER);
  const result = walletCoins(wallet);
  const increment = {pp: Math.floor(amountCp / 1000), gp: Math.floor((amountCp % 1000) / 100),
    sp: Math.floor((amountCp % 100) / 10), cp: amountCp % 10};
  for (const [coin, amount] of Object.entries(increment)) result[coin] = assertInt(result[coin] + amount, 0, Number.MAX_SAFE_INTEGER);
  if (moneyTotal(result) !== moneyTotal(wallet) + amountCp) throw new Error("Currency reconciliation failed");
  return result;
}
export function changeWallet(wallet, diffCp) {
  if (!Number.isSafeInteger(diffCp)) throw new Error("Invalid money adjustment");
  return diffCp < 0 ? spendCoins(wallet, -diffCp) : addCoins(wallet, diffCp);
}
/** All shop prices are stored as integer copper regardless of the selected coin. */
export function priceToCp(value, denomination = "gp") {
  const factor = PRICE_COINS[String(denomination).toLowerCase()];
  if (!factor) throw new Error("Choose PP, GP, SP or CP");
  const raw = String(value ?? "").trim();
  const num = Number(raw);
  if (!raw || !Number.isFinite(num) || num < 0) throw new Error("Invalid price");
  const exact = num * factor;
  const rounded = Math.round(exact);
  if (!Number.isSafeInteger(rounded) || Math.abs(exact - rounded) > 0.000001)
    throw new Error("Price must be a whole number of copper pieces");
  return rounded;
}
export function priceInputValue(amountCp, denomination = "gp") {
  const factor = PRICE_COINS[denomination];
  if (!factor) throw new Error("Invalid currency denomination");
  return String(assertInt(amountCp, 0, Number.MAX_SAFE_INTEGER) / factor);
}
export function priceCoin(item) {
  const denom = String(item?.priceDenomination ?? "gp").toLowerCase();
  return PRICE_COINS[denom] ? denom : "gp";
}
/** Price fields are independent counts, not a normalized wallet.
 * For example, 10 GP stays 10 GP instead of being exchanged for 1 PP.
 */
export function priceCoinsTotal(parts = {}) {
  let total = 0;
  for (const denomination of PRICE_DENOMINATIONS) {
    const count = assertInt(parts?.[denomination] ?? 0, 0, Number.MAX_SAFE_INTEGER);
    total += count * PRICE_COINS[denomination];
    if(!Number.isSafeInteger(total))throw new Error("Price exceeds safe currency limits");
  }
  return total;
}

/** Recreate legacy entries without converting money into larger coins.
 * Old prices remember one denomination (normally GP); keep that denomination.
 */
export function legacyPriceCoins(amountCp, denomination = "gp") {
  let remaining = assertInt(amountCp, 0, Number.MAX_SAFE_INTEGER);
  const coin = PRICE_COINS[String(denomination).toLowerCase()] ? String(denomination).toLowerCase() : "gp";
  const parts = Object.fromEntries(PRICE_DENOMINATIONS.map(name => [name, 0]));
  const start = PRICE_DENOMINATIONS.indexOf(coin);
  for (const name of PRICE_DENOMINATIONS.slice(start)) {
    const count = Math.floor(remaining / PRICE_COINS[name]);
    parts[name] = count;
    remaining -= count * PRICE_COINS[name];
  }
  return parts;
}

/** Persist and render typed counts exactly; fall back safely for old shops.
 * Mismatched legacy metadata cannot change the authoritative copper amount.
 */
export function priceCoinsForEntry(entry) {
  const cp = assertInt(entry?.priceCp ?? 0, 0, Number.MAX_SAFE_INTEGER);
  const saved = entry?.priceCoins;
  if(saved && typeof saved === "object") {
    try {
      const parts = Object.fromEntries(PRICE_DENOMINATIONS.map(c => [c, assertInt(saved[c] ?? 0, 0, Number.MAX_SAFE_INTEGER)]));
      if(priceCoinsTotal(parts) === cp) return parts;
    }catch(_error){ /* Corrupt legacy metadata: recover from priceCp. */ }
  }
  const originalDenomination = entry?.priceDenomination ?? entry?.item?.system?.price?.denomination ?? "gp";
  return legacyPriceCoins(cp, originalDenomination);
}

export function formatPriceCoins(parts) {
  const prices = Object.entries(Object.fromEntries(PRICE_DENOMINATIONS.map(c => [c, assertInt(parts?.[c] ?? 0, 0, Number.MAX_SAFE_INTEGER)])))
    .filter(([_coin, count]) => count>0)
    .map(([coin,count]) => count + " " + coin);
  return prices.join(" ") || "0 cp";
}
export function formatCoins(amountCp) {
  let cp = assertInt(amountCp, 0, Number.MAX_SAFE_INTEGER);
  const output = [];
  for (const [denom, factor] of Object.entries(PRICE_COINS)) {
    const count = Math.floor(cp / factor);
    if (count) output.push(count + " " + denom);
    cp %= factor;
  }
  return output.join(" ") || "0 cp";
}
export function formatWallet(wallet = {}) {
  const coins = walletCoins(wallet);
  return ["pp","gp","ep","sp","cp"].filter(coin => coins[coin])
    .map(coin => coins[coin] + " " + coin).join(" ") || "0 cp";
}
export function gpToCp(value) {
  return priceToCp(value, "gp");
}
export function cpToGp(cp) { return (assertInt(cp, 0, Number.MAX_SAFE_INTEGER) / 100).toFixed(2); }
export function itemPriceCp(item) {
  const data = item?.system?.price;
  const value = (typeof data === "number") ? data : (typeof data?.value === "number" ? data.value : Number(data?.value ?? 0));
  const denomination = String(data?.denomination ?? "gp").toLowerCase();
  const scale = COINS[denomination] ?? 100;
  const cp = Math.round(value * scale);
  return Number.isSafeInteger(cp) && cp >= 0 ? cp : 0;
}
export function emptyShop() {
  return {enabled: false, open: true, allowSelling: true, sellRate: 0.5, hideTradeTerms: true, cashboxCp: 0, stock: [], ledger: [], tables: []};
}
export function shopData(actor) {
  const saved = actor?.getFlag?.(MODULE_ID, "shop") ?? {};
  const clean = {...emptyShop(), ...saved};
  clean.stock = Array.isArray(clean.stock) ? clean.stock : [];
  clean.ledger = Array.isArray(clean.ledger) ? clean.ledger : [];
  clean.tables = Array.isArray(clean.tables) ? clean.tables : [];
  clean.cashboxCp = Number.isSafeInteger(clean.cashboxCp) && clean.cashboxCp >= 0 ? clean.cashboxCp : 0;
  return clean;
}
/** Only public-safe stock fields go to players, never transaction ledger. */
export function publicShop(shop) {
  return {
    enabled: !!shop.enabled, open: !!shop.open, allowSelling: !!shop.allowSelling,
    sellRate: Number(shop.sellRate) || 0,
    hideTradeTerms: shop.hideTradeTerms !== false,
    stock: (shop.stock ?? []).map(s => ({
      id: s.id,
      item: {name: String(s.item?.name ?? "Item"), img: String(s.item?.img ?? "icons/svg/item-bag.svg"), category: itemCategory(s.item)},
      priceCp: s.priceCp, priceDenomination: priceCoin(s), priceCoins: priceCoinsForEntry(s),
      // Never send real quantities or the unlimited flag to player clients.
      // The GM validates actual stock at checkout.
      available: !!s.unlimited || Number(s.quantity) > 0
    })),
    ledger: []
  };
}
export function hasOwnership(actor, user) {
  if (!actor || !user) return false;
  return !!(user.isGM || actor.testUserPermission?.(user, "OWNER"));
}
export function itemCopy(item, qty) {
  const data = item?.toObject ? item.toObject() : structuredClone(item);
  delete data._id;
  delete data.id;
  delete data.folder;
  delete data.sort;
  delete data.ownership;
  data.system = {...(data.system ?? {}), quantity: qty};
  return data;
}
export function stockCopy(item, quantity, priceCp = itemPriceCp(item)) {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const denomination = item?.system?.price?.denomination ?? "gp";
  const price = assertInt(priceCp, 0, Number.MAX_SAFE_INTEGER);
  return {id: uuid, item: itemCopy(item, 1), quantity: assertInt(quantity, 1),
    priceCp: price, priceDenomination: denomination, priceCoins: legacyPriceCoins(price, denomination), unlimited: false};
}
export function recordTransaction(shop, entry) {
  return {...shop, ledger: [...(shop.ledger ?? []), entry].slice(-60)};
}
