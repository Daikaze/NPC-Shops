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

/**
 * Calculate a real user drag on the merchant's horizontal or vertical border.
 * In particular, dragging the RIGHT border changes width without relocating the
 * LEFT side. This avoids the old bottom-corner/native-CSS resize ambiguity.
 */
export function resizeShopFrame(start, dx, dy, edge, viewportWidth, viewportHeight) {
  const margin = 8;
  const vw = Math.max(1, Number(viewportWidth) || 1);
  const vh = Math.max(1, Number(viewportHeight) || 1);
  const safe = clampShopFrame(start, vw, vh);
  const minW = Math.min(350, Math.max(1, vw - margin * 2));
  const minH = Math.min(300, Math.max(1, vh - margin * 2));
  const nX = Number.isFinite(dx) ? dx : 0;
  const nY = Number.isFinite(dy) ? dy : 0;
  let {left, top, width, height} = safe;
  if (edge.includes('left')) {
    const right = left + width;
    left = Math.max(margin, Math.min(right - minW, left + nX));
    width = right - left;
  } else if (edge.includes('right')) {
    width = Math.min(vw - margin - left, Math.max(minW, width + nX));
  }
  if (edge.includes('top')) {
    const bottom = top + height;
    top = Math.max(margin, Math.min(bottom - minH, top + nY));
    height = bottom - top;
  } else if (edge.includes('bottom')) {
    height = Math.min(vh - margin - top, Math.max(minH, height + nY));
  }
  return clampShopFrame({left,top,width,height},vw,vh);
}
