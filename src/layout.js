/** Clamp the GM's movable Shops button inside the viewport. */
export function clampButtonPosition(position, viewportWidth, viewportHeight, buttonWidth, buttonHeight){
  const margin=8,maxX=Math.max(margin,viewportWidth-buttonWidth-margin),maxY=Math.max(margin,viewportHeight-buttonHeight-margin);
  const x=Number.isFinite(position?.x)?position.x:Math.max(margin,viewportWidth-340);
  const y=Number.isFinite(position?.y)?position.y:115;
  return {x:Math.round(Math.max(margin,Math.min(maxX,x))),y:Math.round(Math.max(margin,Math.min(maxY,y)))};
}

/**
 * Keep the merchant window's real pixel bounds visible. The legacy storefront
 * has a fixed initial width, so a CSS-only resize grip can end up off-screen.
 * This helper accepts width/height separately and never alters the requested
 * top-left corner during a bottom-right drag unless the viewport demands it.
 */
export function clampShopFrame(frame, viewportWidth, viewportHeight) {
  const margin = 8;
  const viewportW = Math.max(1, Number(viewportWidth) || 1);
  const viewportH = Math.max(1, Number(viewportHeight) || 1);
  const maximumW = Math.max(1, viewportW - margin * 2);
  const maximumH = Math.max(1, viewportH - margin * 2);
  const minimumW = Math.min(350, maximumW);
  const minimumH = Math.min(300, maximumH);
  const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const width = Math.round(Math.min(maximumW, Math.max(minimumW, finite(frame?.width, 900))));
  const height = Math.round(Math.min(maximumH, Math.max(minimumH, finite(frame?.height, 700))));
  const left = Math.round(Math.min(Math.max(margin, viewportW - width - margin), Math.max(margin, finite(frame?.left, margin))));
  const top = Math.round(Math.min(Math.max(margin, viewportH - height - margin), Math.max(margin, finite(frame?.top, margin))));
  return {left, top, width, height};
}

/** Match the visible storefront grid to its own width, not to screen width. */
export function shopSizeLayout(width) {
  if (width < 540) return "compact";
  if (width < 850) return "medium";
  return "wide";
}
