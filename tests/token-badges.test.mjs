import test from 'node:test';
import assert from 'node:assert/strict';
import {TokenShopBadges, merchantBadgePosition, badgeViewportPosition} from '../src/token-badges.js';

function makeWorld() {
  const buttons = [];
  const doc = {
    body: {appendChild(el){buttons.push(el); el.attached = true;}},
    createElement(tag){
      assert.equal(tag,'button');
      const handlers = {};
      return {
        style:{},handlers,
        setAttribute(){}, addEventListener(name,fn){handlers[name]=fn;},
        remove(){this.removed=true; this.attached=false;},
        fire(name){handlers[name]?.({preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}});}
      };
    }
  };
  const board = {getBoundingClientRect(){return {left:20,top:30,width:800,height:600,right:820,bottom:630};}};
  const canvas = {ready:true,app:{canvas:board,renderer:{screen:{width:800,height:600}}}};
  let rafCounter=0;
  const requested = new Map(), cancelled=[];
  const requestFrame = cb => {const id=++rafCounter;requested.set(id,cb);return id;};
  const cancelFrame = id => {cancelled.push(id);requested.delete(id);};
  return {doc,board,canvas,buttons,requested,cancelled,requestFrame,cancelFrame};
}
function merchant(x=240,y=280) {
  const t={document:{id:'t1',actorId:'merchant-1',hidden:false},visible:true,name:'Kiro Shop',w:100,h:100,x,y};
  t.toGlobal=({x,y})=>({x:t.x+x,y:t.y+y});
  return t;
}

test('badge coordinate sits above token image',()=>{
  assert.deepEqual(merchantBadgePosition({w:100,h:100}),{x:50,y:-23,size:16});
});
test('viewport coordinate follows token and scales renderer coordinates',()=>{
  const {board}=makeWorld();const token=merchant();
  assert.deepEqual(badgeViewportPosition(token,board,{width:800,height:600}),{x:310,y:287,onScreen:true});
  token.x+=130; token.y+=25;
  assert.deepEqual(badgeViewportPosition(token,board,{width:800,height:600}),{x:440,y:312,onScreen:true});
});
test('native HTML click works above token bounds',()=>{
  const w=makeWorld(), t=merchant();let opened=0;
  const badges = new TokenShopBadges({open:token=>{assert.equal(token,t);opened++;},isMerchant:()=>true,getCanvas:()=>w.canvas,documentRef:w.doc,requestFrame:w.requestFrame,cancelFrame:w.cancelFrame});
  badges.sync([t]);
  assert.equal(w.buttons.length,1);
  const btn=w.buttons[0];
  assert.equal(btn.style.left,'310px');
  assert.equal(btn.style.top,'287px');
  btn.fire('click');assert.equal(opened,1);
  t.x+=100;badges.updatePositions();
  assert.equal(btn.style.left,'410px');
  btn.fire('click');assert.equal(opened,2);
  badges.clear();assert.equal(btn.removed,true);
});
test('updates every animation frame, independently of canvasPan hooks',()=>{
  const w=makeWorld(),t=merchant();
  const badges=new TokenShopBadges({open:()=>{},isMerchant:()=>true,getCanvas:()=>w.canvas,documentRef:w.doc,requestFrame:w.requestFrame,cancelFrame:w.cancelFrame});
  badges.sync([t]);t.x+=75;
  const [id,cb]=[...w.requested][0];w.requested.delete(id);cb();
  assert.equal(w.buttons[0].style.left,'385px');
  badges.clear();
});
test('hidden or disabled merchants cannot be clicked',()=>{
  const w=makeWorld(),t=merchant();let enabled=true,opened=0;
  const badges=new TokenShopBadges({open:()=>opened++,isMerchant:()=>enabled,getCanvas:()=>w.canvas,documentRef:w.doc,requestFrame:w.requestFrame,cancelFrame:w.cancelFrame});
  badges.sync([t]);const btn=w.buttons[0];
  enabled=false;btn.fire('click');assert.equal(opened,0);
  badges.sync([t]);assert.equal(btn.removed,true);
  enabled=true;badges.sync([t]);
  t.visible=false;badges.updatePositions();assert.equal(w.buttons[1].style.display,'none');
  badges.sync([]);assert.equal(w.buttons[1].removed,true);
});
test('offscreen buttons hide, canvas teardown cleans up',()=>{
  const w=makeWorld(),t=merchant(2000,1000);
  const badges=new TokenShopBadges({open:()=>{},isMerchant:()=>true,getCanvas:()=>w.canvas,documentRef:w.doc,requestFrame:w.requestFrame,cancelFrame:w.cancelFrame});
  badges.sync([t]);assert.equal(w.buttons[0].style.display,'none');
  t.x=200;t.y=280;badges.updatePositions();assert.equal(w.buttons[0].style.display,'');
  w.canvas.ready=false;badges.updatePositions();assert.equal(w.buttons[0].style.display,'none');
  badges.clear();assert.equal(w.buttons[0].removed,true);
});
