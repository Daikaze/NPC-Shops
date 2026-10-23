import {itemCategory} from "./categories.js";
export const MODULE_ID = "npc-shops";
export const COINS = Object.freeze({pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1});
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
  const increment = {gp: Math.floor(amountCp / 100), sp: Math.floor((amountCp % 100) / 10), cp: amountCp % 10};
  for (const [coin, amount] of Object.entries(increment)) result[coin] = assertInt(result[coin] + amount, 0, Number.MAX_SAFE_INTEGER);
  if (moneyTotal(result) !== moneyTotal(wallet) + amountCp) throw new Error("Currency reconciliation failed");
  return result;
}
export function changeWallet(wallet, diffCp) {
  if (!Number.isSafeInteger(diffCp)) throw new Error("Invalid money adjustment");
  return diffCp < 0 ? spendCoins(wallet, -diffCp) : addCoins(wallet, diffCp);
}
export function gpToCp(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 100000000) throw new Error("Invalid price");
  const cp = Math.round(num * 100);
  if (Math.abs(num * 100 - cp) > 0.000001) throw new Error("Prices use at most two decimal places of GP");
  return cp;
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
  return {enabled: false, open: true, allowSelling: true, sellRate: 0.5, stock: [], ledger: [], tables: [], autoTextLoot: true, textLootPriceCp: 0};
}
export function shopData(actor) {
  const saved = actor?.getFlag?.(MODULE_ID, "shop") ?? {};
  const clean = {...emptyShop(), ...saved};
  clean.stock = Array.isArray(clean.stock) ? clean.stock : [];
  clean.ledger = Array.isArray(clean.ledger) ? clean.ledger : [];
  clean.tables = Array.isArray(clean.tables) ? clean.tables : [];
  clean.autoTextLoot = clean.autoTextLoot !== false;
  clean.textLootPriceCp = Number.isSafeInteger(clean.textLootPriceCp) && clean.textLootPriceCp >= 0 ? clean.textLootPriceCp : 0;
  return clean;
}
/** Only public-safe stock fields go to players, never transaction ledger. */
export function publicShop(shop) {
  return {
    enabled: !!shop.enabled, open: !!shop.open, allowSelling: !!shop.allowSelling,
    sellRate: Number(shop.sellRate) || 0,
    stock: (shop.stock ?? []).map(s => ({id: s.id, item: {name: String(s.item?.name ?? "Item"), img: String(s.item?.img ?? "icons/svg/item-bag.svg"), category: itemCategory(s.item)}, priceCp: s.priceCp, quantity: s.quantity, unlimited: !!s.unlimited})),
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
  return {id: uuid, item: itemCopy(item, 1), quantity: assertInt(quantity, 1), priceCp: assertInt(priceCp), unlimited: false};
}
export function recordTransaction(shop, entry) {
  return {...shop, ledger: [...(shop.ledger ?? []), entry].slice(-60)};
}
