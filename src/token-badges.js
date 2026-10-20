/** Token-local PIXI markers: inherited transform follows NPC movement, behind Foundry sheets. */
export function merchantBadgePosition(token) {
  const width=Number(token?.w ?? token?.width ?? 0);
  const height=Number(token?.h ?? token?.height ?? 0);
  const size=Math.max(10, Math.min(16, Math.min(width||80,height||80)/5));
  return {x:Math.max(size+1,width/2),y:-size-7,size};
}
function fillCircle(g,r) {
  if(typeof g.circle==='function' && typeof g.fill==='function') g.circle(0,0,r).fill(0x382a18).stroke({width:2,color:0xf1ca76});
  else g.lineStyle(2,0xf1ca76).beginFill(0x382a18).drawCircle(0,0,r).endFill();
}
function fillRect(g,x,y,w,h,c){
  if(typeof g.rect==='function' && typeof g.fill==='function')g.rect(x,y,w,h).fill(c);
  else g.beginFill(c).drawRect(x,y,w,h).endFill();
}
export function makeShopBadge(PIXI,onOpen) {
  const badge=new PIXI.Container(), g=new PIXI.Graphics();
  fillCircle(g,16);
  fillRect(g,-8,-3,16,11,0xffdf9c);
  fillRect(g,-10,-8,20,5,0xffdf9c);
  fillRect(g,-2,2,4,6,0x382a18);
  badge.addChild(g);
  badge.eventMode='static';
  badge.interactive=true;
  badge.buttonMode=true;
  badge.cursor='pointer';
  badge.hitArea=new PIXI.Circle(0,0,19);
  const stop=e=>e.stopPropagation?.();
  badge.on('pointerdown',stop);
  badge.on('pointerup',stop);
  badge.on('pointertap',e=>{stop(e);onOpen();});
  return badge;
}
export class TokenShopBadges {
  constructor({pixi,open,isMerchant}){this.pixi=pixi;this.open=open;this.isMerchant=isMerchant;this.current=new Map();}
  clear(){
    for(const {badge} of this.current.values()){
      if(!badge.destroyed){badge.parent?.removeChild(badge);badge.destroy({children:true});}
    }
    this.current.clear();
  }
  sync(tokens){
    const live=new Set();
    for(const token of tokens??[]){
      if(!token?.document?.actorId || token.document.hidden || !token.visible || !this.isMerchant(token))continue;
      const id=token.document.id;live.add(id);
      let pair=this.current.get(id);
      if(pair && (pair.token!==token || pair.badge.destroyed || pair.badge.parent!==token)){
        if(!pair.badge.destroyed){pair.badge.parent?.removeChild(pair.badge);pair.badge.destroy({children:true});}
        pair=undefined;
      }
      if(!pair){
        const badge=makeShopBadge(this.pixi,()=>this.open(token));
        token.addChild(badge);
        pair={token,badge};this.current.set(id,pair);
      }
      const {x,y,size}=merchantBadgePosition(token);
      pair.badge.position.set(x,y);
      pair.badge.scale.set(size/16);
    }
    for(const [id,pair] of this.current){
      if(live.has(id))continue;
      if(!pair.badge.destroyed){pair.badge.parent?.removeChild(pair.badge);pair.badge.destroy({children:true});}
      this.current.delete(id);
    }
  }
}
