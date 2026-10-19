import test from 'node:test';
import assert from 'node:assert/strict';
import {TokenShopBadges,merchantBadgePosition} from '../src/token-badges.js';
class Container {
 constructor(){this.children=[];this.parent=null;this.handlers={};this.position={set:(x,y)=>{this.x=x;this.y=y}};this.scale={set:n=>this.scaleValue=n};this.destroyed=false;}
 addChild(c){this.children.push(c);c.parent=this;}
 removeChild(c){this.children=this.children.filter(x=>x!==c);c.parent=null;}
 destroy(){this.destroyed=true;}
 on(k,v){this.handlers[k]=v;}
}
class Circle{}
class V7Graphics extends Container{lineStyle(){return this}beginFill(){return this}drawCircle(){return this}drawRect(){return this}endFill(){return this}}
class V8Graphics extends Container{circle(){return this}rect(){return this}fill(){return this}stroke(){return this}}
for(const Graphics of [V7Graphics,V8Graphics]){
 test('PIXI token-local merchant marker follows and opens on click',()=>{
  const t=new Container();t.document={id:'npc',actorId:'actor',hidden:false};t.visible=true;t.w=t.h=100;
  let opens=0;
  const m=new TokenShopBadges({pixi:{Container,Graphics,Circle},open:()=>opens++,isMerchant:()=>true});
  m.sync([t]);const badge=t.children[0];
  assert.equal(badge.parent,t);assert.equal(badge.x,50);
  badge.handlers.pointertap({stopPropagation(){}});assert.equal(opens,1);
  t.x=500;m.sync([t]);assert.equal(t.children[0],badge);
  m.sync([]);assert.equal(t.children.length,0);
 });
}
test('merchant marker coordinates are local to token',()=>assert.deepEqual(merchantBadgePosition({w:100,h:100}),{x:50,y:18,size:16}));
