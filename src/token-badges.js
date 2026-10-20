/**
 * NPC Shops merchant marker. One fixed-size HTML button in the token's TOP RIGHT
 * corner (not above the token). This uses no PIXI icon, icon scaling, or CSS
 * animation. Move/zoom position is projected from the displayed Token itself.
 *
 * In v14 the PIXI application ticker is used after token animation ticks; v11
 * can use requestAnimationFrame when the ticker is unavailable.
 */
export const SHOP_ICON_SIZE = 30;
export const SHOP_ICON_INSET = 16;

export function tokenCornerOnScreen(token, board, rendererScreen, inset = SHOP_ICON_INSET) {
  if (!token || !board || typeof board.getBoundingClientRect !== 'function'
      || typeof token.toGlobal !== 'function') return null;
  const bounds = board.getBoundingClientRect();
  const screenWidth = Number(rendererScreen?.width) || bounds.width;
  const screenHeight = Number(rendererScreen?.height) || bounds.height;
  const tokenWidth = Number(token.w ?? token.width ?? 0);
  if (!(screenWidth > 0 && screenHeight > 0 && tokenWidth > 0)) return null;

  // We read the live token transform AFTER Foundry has updated its position.
  // The absolute top-right corner is projected into the viewport, then we
  // subtract a CSS-pixel inset. This prevents zoom from resizing the icon.
  const corner = token.toGlobal({x: tokenWidth, y: 0});
  if (!Number.isFinite(corner?.x) || !Number.isFinite(corner?.y)) return null;
  const cornerX = bounds.left + corner.x * bounds.width / screenWidth;
  const cornerY = bounds.top + corner.y * bounds.height / screenHeight;
  const x = cornerX - inset;
  const y = cornerY + inset;
  const radius = SHOP_ICON_SIZE / 2;
  return {x,y,onScreen:
    x >= bounds.left + radius && x <= bounds.right - radius &&
    y >= bounds.top + radius && y <= bounds.bottom - radius};
}

export class TokenShopBadges {
  constructor({open, isMerchant, getCanvas = () => globalThis.canvas,
    documentRef = globalThis.document,
    requestFrame = cb => globalThis.requestAnimationFrame(cb),
    cancelFrame = id => globalThis.cancelAnimationFrame(id)} = {}) {
    this.open = open;
    this.isMerchant = isMerchant;
    this.getCanvas = getCanvas;
    this.document = documentRef;
    this.requestFrame = requestFrame;
    this.cancelFrame = cancelFrame;
    this.current = new Map();
    this.frame = null;
    this.ticker = null;
  }
  isVisibleMerchant(token) {
    return Boolean(token && !token.destroyed && token.document?.actorId &&
      !token.document.hidden && token.visible && this.isMerchant(token));
  }
  createButton(token) {
    const button = this.document.createElement('button');
    button.type = 'button';
    button.className = 'npc-shop-token-button';
    button.title = 'Open ' + (token.name || token.actor?.name || 'merchant') + ' shop';
    button.setAttribute('aria-label', button.title);
    button.innerHTML = '<i class="fas fa-store" aria-hidden="true"></i>';
    for (const name of ['pointerdown','mousedown','pointerup']) {
      button.addEventListener(name, e => e.stopPropagation());
    }
    button.addEventListener('click', e => {
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();
      const pair=this.current.get(token.document.id);
      if (pair?.token === token && this.isVisibleMerchant(token)) this.open(token);
    });
    this.document.body.appendChild(button);
    return button;
  }
  remove(id) {
    this.current.get(id)?.button.remove();
    this.current.delete(id);
  }
  clear() {
    if (this.ticker) { this.ticker.remove(this.updatePositions,this); this.ticker=null; }
    if (this.frame!==null) { this.cancelFrame(this.frame); this.frame=null; }
    for (const id of [...this.current.keys()]) this.remove(id);
  }
  updatePositions() {
    const scene=this.getCanvas();
    const board=scene?.app?.canvas || scene?.app?.view || this.document?.querySelector?.('canvas#board');
    const screen=scene?.app?.renderer?.screen;
    for (const {token,button} of this.current.values()) {
      if (!scene?.ready || !this.isVisibleMerchant(token)) {
        button.style.display='none';continue;
      }
      const point=tokenCornerOnScreen(token,board,screen);
      if (!point?.onScreen) {
        button.style.display='none';continue;
      }
      button.style.display='';
      // position is set directly each render tick: no easing, tween or scaling.
      button.style.left=point.x+'px';
      button.style.top=point.y+'px';
    }
  }
  tick() {
    this.frame=null;
    if (!this.current.size) return;
    this.updatePositions();
    this.frame=this.requestFrame(()=>this.tick());
  }
  sync(tokens) {
    const live=new Set();
    for (const token of tokens || []) {
      if (!this.isVisibleMerchant(token) || !token.document.id) continue;
      const id=token.document.id;live.add(id);
      const pair=this.current.get(id);
      if (pair?.token!==undefined && pair.token!==token) this.remove(id);
      if (!this.current.has(id)) this.current.set(id,{token,button:this.createButton(token)});
    }
    for (const id of [...this.current.keys()]) if (!live.has(id)) this.remove(id);
    this.updatePositions();

    // HIGHLY LATE in PIXI's render loop (after token motion is applied).
    const ticker=this.getCanvas()?.app?.ticker;
    if (this.ticker && (this.ticker!==ticker || !this.current.size)) {
      this.ticker.remove(this.updatePositions,this);this.ticker=null;
    }
    if (this.current.size && ticker?.add) {
      if(this.frame!==null){this.cancelFrame(this.frame);this.frame=null;}
      if(!this.ticker){ticker.add(this.updatePositions,this,-1000);this.ticker=ticker;}
    } else if(this.current.size && this.frame===null) this.frame=this.requestFrame(()=>this.tick());
    if(!this.current.size && this.frame!==null){this.cancelFrame(this.frame);this.frame=null;}
  }
}
