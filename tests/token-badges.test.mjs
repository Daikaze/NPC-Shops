import test from 'node:test';
import assert from 'node:assert/strict';
import {TokenShopBadges,merchantBadgePosition,badgeViewportPosition,tokenPixelsPerLocalUnit} from '../src/token-badges.js';

class Container{
  constructor(){
    this.children=[];this.parent=null;this.destroyed=false;this.visible=true;
    this.position={set:(x,y)=>{this.localX=x;this.localY=y;}};
    this.scale={set:n=>{this.localScale=n;}};
  }
  addChild(c){this.children.push(c);c.parent=this;}
  removeChild(c){this.children=this.children.filter(x=>x!==c);c.parent=null;}
  destroy(){this.destroyed=true;}
}
class Graphics7 extends Container{lineStyle(){return this}beginFill(){return this}drawCircle(){return this}drawRect(){return this}endFill(){return this}}
class Graphics8 extends Container{circle(){return this}rect(){return this}fill(){return this}stroke(){return this}}
function world(Graphics=Graphics8){
  const buttons=[];
  const doc={body:{appendChild(el){buttons.push(el);el.attached=true;}},
    createElement(){const handlers={};return {style:{},handlers,setAttribute(){},
      addEventListener(k,fn){handlers[k]=fn;},remove(){this.removed=true;},
      fire(k){handlers[k]?.({preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}})}};}};
  const board={getBoundingClientRect(){return {left:20,top:30,width:800,height:600,right:820,bottom:630};}};
  const canvas={ready:true,app:{canvas:board,renderer:{screen:{width:800,height:600}}}};
  const calls=new Map();let id=0;
  const requestFrame=fn=>{calls.set(++id,fn);return id};
  const cancelFrame=n=>calls.delete(n);
  return {doc,board,canvas,buttons,calls,requestFrame,cancelFrame,pixi:{Container,Graphics}};
}
function merchant(x=240,y=280,zoom=1){
  const t=new Container();
  Object.assign(t,{document:{id:'m',actorId:'actor',hidden:false},name:'Kiro Shop',w:100,h:100,x,y,zoom});
  t.toGlobal=({x,y})=>({x:t.x+x*t.zoom,y:t.y+y*t.zoom});
  return t;
}
function manager(w,open=()=>{},isMerchant=()=>true){
  return new TokenShopBadges({pixi:w.pixi,open,isMerchant,getCanvas:()=>w.canvas,documentRef:w.doc,
    requestFrame:w.requestFrame,cancelFrame:w.cancelFrame});
}
test('visual stays above token at exactly the same screen size through zoom',()=>{
  const w=world(),t=merchant();
  for(const zoom of [0.2,0.5,1,2,4]){
    t.zoom=zoom;
    const ratio=tokenPixelsPerLocalUnit(t,w.board,{width:800,height:600});
    const p=merchantBadgePosition(t,ratio);
    assert.ok(p.y+p.size<0);
    assert.ok(Math.abs(p.size*zoom-18)<0.00001);
    assert.ok(Math.abs((p.y-p.size)*zoom+43)<0.00001);
  }
});
for(const Graphics of [Graphics7,Graphics8]){
  test('PIXI token child moves in the same transform; native invisible button opens shop',()=>{
    const w=world(Graphics),t=merchant();let opened=0;
    const badges=manager(w,token=>{assert.equal(token,t);opened++;});
    badges.sync([t]);
    const visual=t.children[0],hit=w.buttons[0];
    assert.equal(visual.parent,t);
    assert.equal(visual.eventMode,'none');
    assert.equal(visual.localX,50);assert.equal(visual.localY,-25);
    assert.equal(visual.localScale,18/16);
    assert.equal(hit.style.left,'310px');assert.equal(hit.style.top,'285px');
    hit.fire('click');assert.equal(opened,1);
    t.x+=120;
    assert.equal(visual.parent,t);
    badges.updatePositions();
    assert.equal(hit.style.left,'430px');
    hit.fire('click');assert.equal(opened,2);
    badges.clear();
    assert.equal(visual.destroyed,true);assert.equal(hit.removed,true);
  });
}
test('zoom changes only the inverse PIXI scale, not CSS button size',()=>{
  const w=world(),t=merchant(),badges=manager(w);
  badges.sync([t]);
  const visual=t.children[0],hit=w.buttons[0];
  t.zoom=2;badges.updatePositions();
  assert.equal(visual.localScale,18/32);
  assert.equal(visual.localY,-12.5);
  assert.equal(hit.style.left,'360px');assert.equal(hit.style.top,'285px');
  t.zoom=.5;badges.updatePositions();
  assert.equal(visual.localScale,18/8);
  assert.equal(hit.style.left,'285px');assert.equal(hit.style.top,'285px');
  badges.clear();
});
test('canvas-to-CSS ratio preserves fixed size on resized renderer',()=>{
  const w=world(),t=merchant();
  w.board.getBoundingClientRect=()=>({left:20,top:30,width:400,height:300,right:420,bottom:330});
  assert.equal(tokenPixelsPerLocalUnit(t,w.board,{width:800,height:600}),.5);
  const p=merchantBadgePosition(t,.5);
  assert.equal(p.y,-50);
  const hit=badgeViewportPosition(t,w.board,{width:800,height:600},p);
  assert.equal(hit.x,165);assert.equal(hit.y,145);
});
test('animation ticker updates without detaching and recreating token visual',()=>{
  const w=world(),t=merchant(),badges=manager(w);
  badges.sync([t]);
  const visual=t.children[0];
  t.x+=90;
  const [id,fn]=[...w.calls][0];w.calls.delete(id);fn();
  assert.equal(t.children[0],visual);
  assert.equal(w.buttons[0].style.left,'400px');
  badges.clear();assert.equal(w.calls.size,0);
});
test('hidden, disabled, off-screen and teardown remove or hide hit target and visual',()=>{
  const w=world(),t=merchant();let allowed=true,n=0;
  const badges=manager(w,()=>n++,()=>allowed);
  badges.sync([t]);const hit=w.buttons[0],visual=t.children[0];
  allowed=false;hit.fire('click');assert.equal(n,0);
  badges.sync([t]);assert.equal(hit.removed,true);assert.equal(visual.destroyed,true);
  allowed=true;badges.sync([t]);
  t.visible=false;badges.updatePositions();assert.equal(w.buttons[1].style.display,'none');
  badges.sync([t]);assert.equal(w.buttons[1].removed,true);
  t.visible=true;t.x=3000;badges.sync([t]);
  assert.equal(w.buttons[2].style.display,'none');
  t.x=200;badges.updatePositions();assert.equal(w.buttons[2].style.display,'');
  w.canvas.ready=false;badges.updatePositions();
  assert.equal(t.children[0].visible,false);
  badges.clear();
});
