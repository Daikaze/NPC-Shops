/**
 * NPC Shops token badge based on v0.1.3's proven PIXI-only approach.
 *
 * The visible icon and its click target are both PIXI children of the NPC.
 * Unlike HTML buttons, a token child cannot float over character sheets, lag
 * behind token movement, or change size relative to its token during zoom.
 *
 * IMPORTANT: The icon is INSIDE the upper-right corner of the token. Putting
 * it above/outside the token breaks PIXI hit testing on Foundry v14.
 */

/** Local token coordinates and dimensions, independent of canvas zoom. */
export function merchantBadgePosition(token) {
  const width=Number(token?.w ?? token?.width ?? 0);
  const height=Number(token?.h ?? token?.height ?? 0);
  if(!(width>0 && height>0)) return null;
  // Diameter ~23% of the smaller token dimension; scale is inherited from token.
  const radius=Math.max(5,Math.min(14,Math.min(width,height)*0.115));
  const inset=Math.min(4,Math.min(width,height)*0.06);
  return {x:width-radius-inset,y:radius+inset,size:radius};
}
function fillCircle(g,r){
  if(typeof g.circle==='function' && typeof g.fill==='function')
    g.circle(0,0,r).fill(0x382a18).stroke({width:2,color:0xf1ca76});
  else g.lineStyle(2,0xf1ca76).beginFill(0x382a18).drawCircle(0,0,r).endFill();
}
function fillRect(g,x,y,w,h,color){
  if(typeof g.rect==='function' && typeof g.fill==='function')g.rect(x,y,w,h).fill(color);
  else g.beginFill(color).drawRect(x,y,w,h).endFill();
}

/** Visible and interactive only within token bounds; no DOM/HTML overlays. */
export function makeShopBadge(PIXI,onOpen){
  const badge=new PIXI.Container(),g=new PIXI.Graphics();
  fillCircle(g,16);
  fillRect(g,-8,-3,16,11,0xffdf9c);
  fillRect(g,-10,-8,20,5,0xffdf9c);
  fillRect(g,-2,2,4,6,0x382a18);
  badge.addChild(g);
  badge.eventMode='static';
  badge.interactive=true;
  badge.interactiveChildren=false;
  badge.buttonMode=true;
  badge.cursor='pointer';
  badge.hitArea=new PIXI.Circle(0,0,17);
  const stop=e=>e?.stopPropagation?.();
  badge.on('pointerdown',stop);
  badge.on('pointerup',stop);
  badge.on('pointertap',e=>{stop(e);onOpen();});
  return badge;
}
export class TokenShopBadges{
  constructor({pixi=globalThis.PIXI,open,isMerchant}={}){
    this.pixi=pixi;this.open=open;this.isMerchant=isMerchant;
    this.current=new Map();
  }
  isVisibleMerchant(token){
    return Boolean(token && !token.destroyed && token.document?.actorId &&
      !token.document.hidden && token.visible && this.isMerchant(token));
  }
  remove(id){
    const pair=this.current.get(id);
    if(pair?.badge && !pair.badge.destroyed){
      pair.badge.parent?.removeChild(pair.badge);
      pair.badge.destroy({children:true});
    }
    this.current.delete(id);
  }
  clear(){for(const id of [...this.current.keys()])this.remove(id);}
  sync(tokens){
    const live=new Set();
    for(const token of tokens??[]){
      if(!this.isVisibleMerchant(token) || !token.document.id)continue;
      const pos=merchantBadgePosition(token);
      if(!pos)continue;
      const id=token.document.id;live.add(id);
      const old=this.current.get(id);
      if(old && (old.token!==token || old.badge.destroyed || old.badge.parent!==token))this.remove(id);
      if(!this.current.has(id)){
        const badge=makeShopBadge(this.pixi,()=>{
          if(this.isVisibleMerchant(token))this.open(token);
        });
        token.addChild(badge);
        this.current.set(id,{token,badge});
      }
      const badge=this.current.get(id).badge;
      badge.position.set(pos.x,pos.y);
      badge.scale.set(pos.size/16);
      badge.visible=true;
    }
    for(const id of [...this.current.keys()])if(!live.has(id))this.remove(id);
  }
}
