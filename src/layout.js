/** Clamp the GM's movable Shops button inside the viewport. */
export function clampButtonPosition(position, viewportWidth, viewportHeight, buttonWidth, buttonHeight){
  const margin=8,maxX=Math.max(margin,viewportWidth-buttonWidth-margin),maxY=Math.max(margin,viewportHeight-buttonHeight-margin);
  const x=Number.isFinite(position?.x)?position.x:Math.max(margin,viewportWidth-340);
  const y=Number.isFinite(position?.y)?position.y:115;
  return {x:Math.round(Math.max(margin,Math.min(maxX,x))),y:Math.round(Math.max(margin,Math.min(maxY,y)))};
}
