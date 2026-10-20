/**
 * NPC Shops: proportional merchant badges in token's upper-right corner.
 * A 30px fixed badge was too small on zoom-in and too large on zoom-out.
 * Use the actual displayed token bounds to keep the badge's visual size
 * proportionate to the token. HTML stays clickable without NPC ownership.
 */
export const SHOP_BADGE_RATIO = 0.16;
export const SHOP_BADGE_MIN = 14;
export const SHOP_BADGE_MAX = 44;
export const SHOP_BADGE_PADDING = 3;
export const SHOP_MIN_HIT_AREA = 24;

/** Screen-space size based on the token's displayed dimensions in CSS pixels. */
export function merchantBadgeSize(screenWidth, screenHeight) {
  const smaller = Math.min(Number(screenWidth), Number(screenHeight));
  if (!(smaller > 0) || !Number.isFinite(smaller)) return SHOP_BADGE_MIN;
  return Math.max(SHOP_BADGE_MIN, Math.min(SHOP_BADGE_MAX, Math.round(smaller * SHOP_BADGE_RATIO)));
}

export function tokenCornerOnScreen(token, board, rendererScreen) {
  if (!token || !board?.getBoundingClientRect || typeof token.toGlobal !== 'function') return null;
  const bounds = board.getBoundingClientRect();
  const sw = Number(rendererScreen?.width) || bounds.width;
  const sh = Number(rendererScreen?.height) || bounds.height;
  const tw = Number(token.w ?? token.width ?? 0);
  const th = Number(token.h ?? token.height ?? 0);
  if (!(sw>0 && sh>0 && tw>0 && th>0)) return null;

  // Use displayed coordinates rather than Foundry's document position:
  // this tracks moving/animated tokens and camera zoom on both v11/v14.
  const tl=token.toGlobal({x:0,y:0});
  const tr=token.toGlobal({x:tw,y:0});
  const br=token.toGlobal({x:tw,y:th});
  if (![tl?.x,tl?.y,tr?.x,tr?.y,br?.x,br?.y].every(Number.isFinite)) return null;
  const sx=bounds.width/sw, sy=bounds.height/sh;
  const tokenWidth=Math.hypot((tr.x-tl.x)*sx,(tr.y-tl.y)*sy);
  const tokenHeight=Math.hypot((br.x-tr.x)*sx,(br.y-tr.y)*sy);
  const size=merchantBadgeSize(tokenWidth,tokenHeight);
  const offset=size/2+SHOP_BADGE_PADDING;
  const cornerX=bounds.left+tr.x*sx,cornerY=bounds.top+tr.y*sy;
  const x=cornerX-offset, y=cornerY+offset;
  const hitSize=Math.max(size,SHOP_MIN_HIT_AREA);
  // The badge can slightly overlap the edge of the viewport; hide it if
  // the icon's center is too close to be completely clickable.
  const radius=hitSize/2;
  return {x,y,size,hitSize,onScreen:
    x>=bounds.left+radius && x<=bounds.right-radius &&
    y>=bounds.top+radius && y<=bounds.bottom-radius};
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
    button.innerHTML = '<span class="npc-shop-token-badge"><i class="fas fa-store" aria-hidden="true"></i></span>';
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
      button.style.setProperty('--ns-shop-badge-size',point.size+'px');
      button.style.setProperty('--ns-shop-hit-size',point.hitSize+'px');
      button.style.setProperty('--ns-shop-font-size',Math.max(9,Math.round(point.size*.48))+'px');
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
