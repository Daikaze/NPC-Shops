import test from 'node:test';
import assert from 'node:assert/strict';
import {TokenShopBadges,tokenCornerOnScreen,SHOP_ICON_SIZE} from '../src/token-badges.js';
function world(){
  const buttons=[],calls=new Map(),listeners=new Map();let next=0;
  const doc={
    body:{appendChild(el){buttons.push(el);}},
    createElement(){const callbacks={};
      return {style:{},callbacks,setAttribute(){},
        addEventListener(n,fn){callbacks[n]=fn;},
        remove(){this.removed=true},
        fire(n){callbacks[n]?.({preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}})};
    }}
  };
  const board={getBoundingClientRect(){return {left:10,top:20,width:800,height:600,right:810,bottom:620};}};
  const ticker={
    add(fn,ctx,priority){listeners.set('tick',{fn,ctx,priority})},
    remove(fn,ctx){const t=listeners.get('tick');if(t?.fn===fn && t.ctx===ctx)listeners.delete('tick')}
  };
  const canvas={ready:true,app:{canvas:board,ticker,renderer:{screen:{width:800,height:600}}}};
  const requestFrame=fn=>{calls.set(++next,fn);return next};
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
test('top-right icon is inside token, 30px and independent of zoom scale',()=>{
  const w=world(),t=token(),positions=[];
  for(const z of [0.25,0.5,1,2,4]) {
    t.zoom=z;
    const p=tokenCornerOnScreen(t,w.board,{width:800,height:600});
    assert.equal(p.x,114+100*z);
    assert.equal(p.y,186);
    assert.equal(SHOP_ICON_SIZE,30);
    positions.push(p);
  }
  assert.deepEqual(positions.map(p=>p.y),[186,186,186,186,186]);
});
test('projection converts between renderer pixels and browser CSS pixels',()=>{
  const w=world(),t=token();
  w.board.getBoundingClientRect=()=>({left:10,top:20,width:400,height:300,right:410,bottom:320});
  assert.deepEqual(tokenCornerOnScreen(t,w.board,{width:800,height:600}),{
    x:104, y:111, onScreen:true
  });
});
test('click opens shop and selected token permission is not required',()=>{
  const w=world(),t=token();let count=0;
  const badges=manager(w,()=>count++);
  badges.sync([t]);
  assert.equal(w.buttons[0].innerHTML,'<i class="fas fa-store" aria-hidden="true"></i>');
  assert.equal(w.buttons[0].style.left,'214px');
  assert.equal(w.buttons[0].style.top,'186px');
  w.buttons[0].fire('click');assert.equal(count,1);
  badges.clear();assert.equal(w.buttons[0].removed,true);
});
test('PIXI ticker runs after token movement and updates badge without scaling CSS size',()=>{
  const w=world(),t=token(),badges=manager(w);
  badges.sync([t]);assert.equal(w.listeners.get('tick').priority,-1000);
  assert.equal(w.calls.size,0);
  t.x+=180;t.y+=75;t.zoom=2;
  const {fn,ctx}=w.listeners.get('tick');fn.call(ctx);
  assert.equal(w.buttons[0].style.left,'494px');
  assert.equal(w.buttons[0].style.top,'261px');
  badges.clear();assert.equal(w.listeners.size,0);
});
test('hidden merchants and offscreen merchants do not expose controls',()=>{
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
test('fallback animation frame works in v11 when application ticker unavailable',()=>{
  const w=world(),t=token(),badges=manager(w);
  delete w.canvas.app.ticker;
  badges.sync([t]);assert.equal(w.calls.size,1);
  t.x+=120;
  const [id,fn]=[...w.calls][0];w.calls.delete(id);fn();
  assert.equal(w.buttons[0].style.left,'334px');
  badges.clear();assert.equal(w.calls.size,0);
});
