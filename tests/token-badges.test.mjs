import test from 'node:test';
import assert from 'node:assert/strict';
import {TokenShopBadges,merchantBadgePosition,makeShopBadge} from '../src/token-badges.js';

class Container {
  constructor(){
    this.children=[];this.parent=null;this.destroyed=false;this.visible=true;
    this.handlers={};this.position={set:(x,y)=>{this.x=x;this.y=y;}};
    this.scale={set:n=>{this.scaleValue=n}};
  }
  addChild(obj){this.children.push(obj);obj.parent=this;}
  removeChild(obj){this.children=this.children.filter(x=>x!==obj);obj.parent=null;}
  destroy(){this.destroyed=true;}
  on(type,callback){this.handlers[type]=callback;}
}
class Circle{constructor(x,y,radius){this.x=x;this.y=y;this.radius=radius;}}
class Graphics7 extends Container {
  lineStyle(){return this;}beginFill(){return this;}drawCircle(){return this;}
  drawRect(){return this;}endFill(){return this;}
}
class Graphics8 extends Container {
  circle(){return this;}fill(){return this;}stroke(){return this;}rect(){return this;}
}
function token(width=100,height=100){
  const t=new Container();
  t.document={id:'t1',actorId:'merchant',hidden:false};
  t.w=width;t.h=height;t.name='Shop NPC';t.visible=true;
  return t;
}
const emit=(badge)=>badge.handlers.pointertap({stopPropagation(){}});
test('merchant icon is fully inside the upper-right of the token at all sizes',()=>{
  for(const [w,h] of [[50,50],[100,100],[200,100],[100,200],[400,400]]){
    const pos=merchantBadgePosition({w,h});
    assert.ok(pos.x-pos.size>0);
    assert.ok(pos.x+pos.size<w);
    assert.ok(pos.y-pos.size>0);
    assert.ok(pos.y+pos.size<h);
    assert.ok(pos.x>w/2);
    assert.ok(pos.y<h/2);
  }
});
test('merchant icon does not use canvas zoom; inherits token transform precisely',()=>{
  const t=token(),pos=merchantBadgePosition(t);
  const expected=merchantBadgePosition({...t,zoom:4});
  assert.deepEqual(expected,pos);
  assert.equal(pos.x,84.5);
  assert.equal(pos.y,15.5);
  assert.equal(pos.size,11.5);
});
for(const Graphics of [Graphics7,Graphics8]){
  test('token child icon draws, opens shop, and survives movement/zoom without HTML overlay',()=>{
    const t=token();let opens=0;
    const m=new TokenShopBadges({pixi:{Container,Graphics,Circle},
      isMerchant:()=>true,open:()=>opens++});
    m.sync([t]);
    const badge=t.children[0];
    assert.equal(badge.parent,t);
    assert.equal(badge.eventMode,'static');
    assert.equal(badge.hitArea.radius,17);
    assert.equal(badge.x,84.5);
    assert.equal(badge.y,15.5);
    assert.equal(badge.scaleValue,11.5/16);
    emit(badge);assert.equal(opens,1);
    // PIXI local coordinates and child identity stay the same after movement.
    t.x=450;t.y=220;t.zoom=.2;
    m.sync([t]);assert.equal(t.children[0],badge);
    assert.equal(badge.scaleValue,11.5/16);
    emit(badge);assert.equal(opens,2);
    m.clear();
    assert.equal(badge.destroyed,true);
    assert.equal(t.children.length,0);
  });
}
test('hidden NPC, disabled shop and token removal clear badge and revoke interaction',()=>{
  const t=token();let enabled=true,opens=0;
  const m=new TokenShopBadges({pixi:{Container,Graphics:Graphics7,Circle},
    isMerchant:()=>enabled,open:()=>opens++});
  m.sync([t]);const badge=t.children[0];
  enabled=false;emit(badge);assert.equal(opens,0);
  m.sync([t]);assert.equal(badge.destroyed,true);
  enabled=true;m.sync([t]);assert.equal(t.children.length,1);
  t.document.hidden=true;
  m.sync([t]);assert.equal(t.children.length,0);
  t.document.hidden=false;
  m.sync([t]);assert.equal(t.children.length,1);
  m.sync([]);assert.equal(t.children.length,0);
});
test('no icon on invalid or destroyed tokens',()=>{
  const t=token();t.destroyed=true;
  const m=new TokenShopBadges({pixi:{Container,Graphics:Graphics8,Circle},isMerchant:()=>true,open:()=>{}});
  m.sync([t]);assert.equal(t.children.length,0);
  assert.equal(merchantBadgePosition({w:0,h:100}),null);
});
