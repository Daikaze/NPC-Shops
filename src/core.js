export const MODULE_ID = "npc-shops";
export const COINS = Object.freeze({pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1});
export const SALEABLE_TYPES = new Set(["weapon", "equipment", "consumable", "tool", "loot"]);

export function assertInt(value, min = 0, max = 999999) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`Invalid quantity: ${value}`);
  return n;
}
export function moneyTotal(wallet = {}) {
  let total = 0;
  for (const [coin, factor] of Object.entries(COINS)) {
    const value = Number(wallet[coin] ?? 0);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${coin} balance`);
    total += value * factor;
  }
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
export function changeWallet(wallet, diffCp) {
  if (!Number.isSafeInteger(diffCp)) throw new Error("Invalid money adjustment");
  const sum = moneyTotal(wallet) + diffCp;
  if (!Number.isSafeInteger(sum) || sum < 0) throw new Error("Insufficient funds");
  return moneyBreakdown(sum);
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
  return {enabled: true, open: true, allowSelling: true, sellRate: 0.5, stock: [], ledger: []};
}
export function shopData(actor) {
  const saved = actor?.getFlag?.(MODULE_ID, "shop") ?? {};
  const clean = {...emptyShop(), ...saved};
  clean.stock = Array.isArray(clean.stock) ? clean.stock : [];
  clean.ledger = Array.isArray(clean.ledger) ? clean.ledger : [];
  return clean;
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
