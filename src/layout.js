/** Pure layout helpers shared by Foundry v11/v14. Scene coordinates stay fixed. */
export function shopPinFromToken(doc, gridSize) {
  const cell = Number(gridSize) > 0 ? Number(gridSize) : 100;
  const width = Math.max(1, Number(doc?.width ?? 1));
  const x = Number(doc?.x ?? 0);
  const y = Number(doc?.y ?? 0);
  return {x: x + width * cell / 2, y};
}
export function validShopPin(pin) {
  return pin && Number.isFinite(pin.x) && Number.isFinite(pin.y);
}
/** Project a persistent scene coordinate onto the browser overlay. */
export function pinScreenPoint(pin, transform, rect, viewportWidth, viewportHeight) {
  if (!validShopPin(pin)) return null;
  const scaleX = rect.width / (viewportWidth || rect.width);
  const scaleY = rect.height / (viewportHeight || rect.height);
  const pt = transform(pin);
  return {x: rect.left + pt.x * scaleX, y: rect.top + pt.y * scaleY};
}
export function clampButtonPosition(position, viewportWidth, viewportHeight, buttonWidth, buttonHeight) {
  const margin = 8;
  const maxX = Math.max(margin, viewportWidth - buttonWidth - margin);
  const maxY = Math.max(margin, viewportHeight - buttonHeight - margin);
  const x = Number.isFinite(position?.x) ? position.x : Math.max(margin, viewportWidth - 340);
  const y = Number.isFinite(position?.y) ? position.y : 115;
  return {x: Math.round(Math.max(margin, Math.min(maxX, x))), y: Math.round(Math.max(margin, Math.min(maxY, y)))};
}
