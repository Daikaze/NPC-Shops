import test from 'node:test';
import assert from 'node:assert/strict';
import {TokenShopBadges,tokenCornerOnScreen,merchantBadgeSize} from '../src/token-badges.js';
function world(){
  const buttons=[],calls=new Map(),listeners=new Map();let next=0;
  const doc={
    body:{appendChild(el){buttons.push(el);}},
    createElement(){const callbacks={},properties={};
      return {style:{properties,setProperty(name,value){properties[name]=value;}},callbacks,setAttribute(){},
        addEventListener(n,fn){callbacks[n]=fn;},
        remove(){this.removed=true;},
        fire(n){callbacks[n]?.({preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}})}
      };
    }
  };
  const board={getBoundingClientRect(){return {left:10,top:20,width:800,height:600,right:810,bottom:620};}};
  const ticker={
    add(fn,ctx,priority){listeners.set('tick',{fn,ctx,priority});},
    remove(fn,ctx){const t=listeners.get('tick');if(t?.fn===fn && t.ctx===ctx)listeners.delete('tick');}
  };
  const canvas={ready:true,app:{canvas:board,ticker,renderer:{screen:{width:800,height:600}}}};
  const requestFrame=fn=>{calls.set(++next,fn);return next;};
  const cancelFrame=id=>calls.delete(id);
  return {doc,board,canvas,buttons,calls,listeners,requestFrame,cancelFrame};
}
function token(){
  const obj={document:{id:'token',actorId:'merchant',hidden:false},visible:true,destroyed:false,
    w:100,h:100,name:'Merchant',x:120,y:150,zoom:1};
  obj.toGlobal=({x,y})=>({x:obj.x+x*obj.zoom,y:obj.y+y*obj.zoom});
  return obj;
}
function manager(w,open=()=>{},isMerchant=()=>true){
  return new TokenShopBadges({open,isMerchant,documentRef:w.doc,getCanvas:()=>w.canvas,
    requestFrame:w.requestFrame,cancelFrame:w.cancelFrame});
}
test('small tokens have a small visible icon and large tokens have a larger one',()=>{
  assert.equal(merchantBadgeSize(60,60),14);
  assert.equal(merchantBadgeSize(100,100),16);
  assert.equal(merchantBadgeSize(200,200),32);
  assert.equal(merchantBadgeSize(350,350),44);
  assert.equal(merchantBadgeSize(1000,1000),44);
});
test('corner position tracks token and icon stays inside top-right quadrant',()=>{
  const w=world(),t=token();
  const expected=[
    {zoom:.5,x:170,y:180,size:14},
    {zoom:1,x:219,y:181,size:16},
    {zoom:2,x:311,y:189,size:32},
    {zoom:4,x:505,y:195,size:44}
  ];
  for (const v of expected) {
    t.zoom=v.zoom;
    const p=tokenCornerOnScreen(t,w.board,{width:800,height:600});
    assert.equal(p.x,v.x);
    assert.equal(p.y,v.y);
    assert.equal(p.size,v.size);
  }
});
test('viewport conversion handles a rescaled Foundry canvas',()=>{
  const w=world(),t=token();
  w.board.getBoundingClientRect=()=>({left:10,top:20,width:400,height:300,right:410,bottom:320});
  const p=tokenCornerOnScreen(t,w.board,{width:800,height:600});
  assert.equal(p.size,14);
  assert.equal(p.x,110);
  assert.equal(p.y,105);
});
test('button uses proportional icon CSS but maintains accessible hit area and opens shop',()=>{
  const w=world(),t=token();let count=0;
  const badges=manager(w,()=>count++);
  badges.sync([t]);
  const button=w.buttons[0];
  assert.match(button.innerHTML,/npc-shop-token-badge/);
  assert.equal(button.style.left,'219px');
  assert.equal(button.style.top,'181px');
  assert.equal(button.style.properties['--ns-shop-badge-size'],'16px');
  assert.equal(button.style.properties['--ns-shop-hit-size'],'24px');
  button.fire('click');assert.equal(count,1);
  t.zoom=4;badges.updatePositions();
  assert.equal(button.style.properties['--ns-shop-badge-size'],'44px');
  assert.equal(button.style.properties['--ns-shop-hit-size'],'44px');
  button.fire('click');assert.equal(count,2);
  badges.clear();assert.equal(button.removed,true);
});
test('render ticker follows animation, without a delayed CSS size transition',()=>{
  const w=world(),t=token(),badges=manager(w);
  badges.sync([t]);assert.equal(w.listeners.get('tick').priority,-1000);
  t.x+=180;t.y+=75;t.zoom=2;
  const {fn,ctx}=w.listeners.get('tick');fn.call(ctx);
  assert.equal(w.buttons[0].style.left,'491px');
  assert.equal(w.buttons[0].style.top,'264px');
  assert.equal(w.buttons[0].style.properties['--ns-shop-badge-size'],'32px');
  badges.clear();assert.equal(w.listeners.size,0);
});
test('hidden NPC and offscreen merchant have no clickable icon',()=>{
  const w=world(),t=token();let enabled=true,count=0;
  const badges=manager(w,()=>count++,()=>enabled);
  badges.sync([t]);let btn=w.buttons[0];
  enabled=false;btn.fire('click');assert.equal(count,0);
  badges.sync([]);assert.equal(btn.removed,true);
  enabled=true;badges.sync([t]);btn=w.buttons[1];
  t.visible=false;badges.updatePositions();assert.equal(btn.style.display,'none');
  t.visible=true;t.x=3000;badges.updatePositions();assert.equal(btn.style.display,'none');
  badges.clear();
});
test('v11 fallback still updates via animation frame',()=>{
  const w=world(),t=token(),badges=manager(w);
  delete w.canvas.app.ticker;
  badges.sync([t]);assert.equal(w.calls.size,1);
  t.x+=120;
  const [id,fn]=[...w.calls][0];w.calls.delete(id);fn();
  assert.equal(w.buttons[0].style.left,'339px');
  badges.clear();assert.equal(w.calls.size,0);
});
