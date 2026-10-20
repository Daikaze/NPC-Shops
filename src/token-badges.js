/**
 * The visible icon is a PIXI token child. It inherits Foundry's animated
 * token movement exactly, without chasing it through HTML in subsequent frames.
 * A transparent browser hit target handles click events outside token bounds.
 */
const RADIUS_CSS = 18;
const GAP_CSS = 7;
const MIN_SCALE = 0.01;

export function merchantBadgePosition(token, pixelsPerLocalUnit = 1) {
  const width = Number(token?.w ?? token?.width ?? 0);
  const ratio = Math.max(MIN_SCALE, Number(pixelsPerLocalUnit) || 1);
  return {x: width / 2, y: -(RADIUS_CSS + GAP_CSS) / ratio, size: RADIUS_CSS / ratio};
}

/** Derived screen scale includes canvas zoom, token transforms, and DPI/resizing. */
export function tokenPixelsPerLocalUnit(token, board, rendererScreen) {
  if (!token || typeof token.toGlobal !== 'function') return 1;
  const a = token.toGlobal({x:0,y:0});
  const b = token.toGlobal({x:1,y:0});
  const rect = board?.getBoundingClientRect?.();
  const clientWidth = Number(rect?.width) || Number(rendererScreen?.width) || 1;
  const rendererWidth = Number(rendererScreen?.width) || clientWidth;
  const px = Math.hypot(b.x-a.x,b.y-a.y) * clientWidth / rendererWidth;
  return Number.isFinite(px) && px >= MIN_SCALE ? px : 1;
}

export function badgeViewportPosition(token, board, rendererScreen, position=merchantBadgePosition(token)) {
  if (!token || !board?.getBoundingClientRect || typeof token.toGlobal !== 'function') return null;
  const p=token.toGlobal({x:position.x,y:position.y});
  const rect=board.getBoundingClientRect();
  const sw=Number(rendererScreen?.width)||rect.width;
  const sh=Number(rendererScreen?.height)||rect.height;
  if(!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !(sw>0) || !(sh>0))return null;
  const x=rect.left + p.x*rect.width/sw;
  const y=rect.top + p.y*rect.height/sh;
  const pad=RADIUS_CSS+2;
  return {x,y,onScreen:x>=rect.left+pad&&x<=rect.right-pad&&y>=rect.top+pad&&y<=rect.bottom-pad};
}

function circle(g,r){
  if(typeof g.circle==='function'&&typeof g.fill==='function')g.circle(0,0,r).fill(0x382a18).stroke({width:2,color:0xf1ca76});
  else g.lineStyle(2,0xf1ca76).beginFill(0x382a18).drawCircle(0,0,r).endFill();
}
function rect(g,x,y,w,h,c){
  if(typeof g.rect==='function'&&typeof g.fill==='function')g.rect(x,y,w,h).fill(c);
  else g.beginFill(c).drawRect(x,y,w,h).endFill();
}
export function makeShopVisual(PIXI){
  const visual=new PIXI.Container(),g=new PIXI.Graphics();
  circle(g,16);rect(g,-8,-3,16,11,0xffdf9c);rect(g,-10,-8,20,5,0xffdf9c);rect(g,-2,2,4,6,0x382a18);
  visual.addChild(g);
  visual.eventMode='none';visual.interactive=false;visual.interactiveChildren=false;
  return visual;
}

export class TokenShopBadges {
  constructor({pixi=globalThis.PIXI,open,isMerchant,getCanvas=()=>globalThis.canvas,
    documentRef=globalThis.document,requestFrame=callback=>globalThis.requestAnimationFrame(callback),
    cancelFrame=id=>globalThis.cancelAnimationFrame(id)}={}){
    this.pixi=pixi;this.open=open;this.isMerchant=isMerchant;this.getCanvas=getCanvas;
    this.document=documentRef;this.requestFrame=requestFrame;this.cancelFrame=cancelFrame;
    this.current=new Map();this.frame=null;
  }
  createHitButton(token){
    const button=this.document.createElement('button');
    button.type='button';button.className='npc-shop-token-button';
    button.title=`Open ${token.name||token.actor?.name||'merchant'} shop`;
    button.setAttribute('aria-label',button.title);
    button.innerHTML='';
    for(const type of ['pointerdown','mousedown','pointerup'])button.addEventListener(type,e=>e.stopPropagation());
    button.addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();
      const pair=this.current.get(token.document.id);
      if(pair && pair.token===token && this.isVisibleMerchant(token))this.open(token);
    });
    this.document.body.appendChild(button);
    return button;
  }
  isVisibleMerchant(token){
    return !!(token&&!token.destroyed&&token.document?.actorId&&!token.document.hidden&&token.visible&&this.isMerchant(token));
  }
  remove(id){
    const pair=this.current.get(id);
    pair?.button?.remove();
    if(pair?.visual&&!pair.visual.destroyed){
      pair.visual.parent?.removeChild(pair.visual);
      pair.visual.destroy({children:true});
    }
    this.current.delete(id);
  }
  clear(){
    if(this.frame!==null)this.cancelFrame(this.frame);
    this.frame=null;
    for(const id of [...this.current.keys()])this.remove(id);
  }
  updatePositions(){
    const canvas=this.getCanvas();
    const board=canvas?.app?.canvas??canvas?.app?.view??this.document?.querySelector?.('canvas#board');
    const screen=canvas?.app?.renderer?.screen;
    for(const {token,visual,button} of this.current.values()){
      if(!canvas?.ready||!this.isVisibleMerchant(token)){
        visual.visible=false;button.style.display='none';continue;
      }
      if(visual.parent!==token&&!visual.destroyed)token.addChild(visual);
      const pxScale=tokenPixelsPerLocalUnit(token,board,screen);
      const position=merchantBadgePosition(token,pxScale);
      visual.position.set(position.x,position.y);
      visual.scale.set(position.size/16);
      visual.visible=true;
      const hit=badgeViewportPosition(token,board,screen,position);
      if(!hit?.onScreen){button.style.display='none';continue;}
      button.style.display='';
      button.style.left=`${hit.x}px`;
      button.style.top=`${hit.y}px`;
    }
  }
  tick(){
    this.frame=null;
    if(!this.current.size)return;
    this.updatePositions();
    this.frame=this.requestFrame(()=>this.tick());
  }
  sync(tokens){
    const live=new Set();
    for(const token of tokens??[]){
      if(!this.isVisibleMerchant(token)||!token.document.id)continue;
      const id=token.document.id;live.add(id);
      const pair=this.current.get(id);
      if(pair&&(pair.token!==token||pair.visual.destroyed))this.remove(id);
      if(!this.current.has(id)){
        const visual=makeShopVisual(this.pixi);
        token.addChild(visual);
        this.current.set(id,{token,visual,button:this.createHitButton(token)});
      }
    }
    for(const id of [...this.current.keys()])if(!live.has(id))this.remove(id);
    this.updatePositions();
    if(this.current.size&&this.frame===null)this.frame=this.requestFrame(()=>this.tick());
    if(!this.current.size&&this.frame!==null){this.cancelFrame(this.frame);this.frame=null;}
  }
}
