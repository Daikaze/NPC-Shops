import test from 'node:test';
import assert from 'node:assert/strict';
import {hudElement, currentHudToken, isTokenHudApplication, injectMerchantHudControl} from '../src/hud-controls.js';

function mockUi(classic = false) {
  const listeners = {};
  const button = {
    className: '', style: {}, title: '',
    classList: {add(name){button.className += ' ' + name;}},
    setAttribute(){}, addEventListener(name, fn){listeners[name]=fn;},
    fire(name){listeners[name]?.({preventDefault(){}, stopPropagation(){}});}
  };
  const container = {appendChild(el){this.child=el;}};
  const root = {
    style: {}, ownerDocument: {createElement:()=>button},
    querySelector(sel){
      if (sel === '.npc-shop-hud') return container.child?.className.includes('npc-shop-hud') ? container.child : null;
      if (sel === '.col.left' || sel === '.hud-column.left') return classic ? container : null;
      return null;
    },appendChild(el){container.appendChild(el);}
  };
  return {root,button,container};
}
const token={actor:{id:'npc-1',type:'npc'},document:{actorId:'npc-1'},name:'NPC'};
const pcToken={actor:{id:'character-1',type:'character'},document:{actorId:'character-1'},name:'Player Character'};
test('v14 TokenHUD can be identified by class or instance',()=>{
  assert.equal(isTokenHudApplication({constructor:{name:'TokenHUD'}}),true);
  const app={};assert.equal(isTokenHudApplication(app,app),true);
  assert.equal(isTokenHudApplication({constructor:{name:'CharacterSheet'}}),false);
});
test('supports v11 jQuery root and v14 native/app.element root',()=>{
  const {root}=mockUi();
  assert.equal(hudElement({},[root]),root);
  assert.equal(hudElement({element:root},null),root);
});
test('uses a controlled fallback token when v14 HUD object is unavailable',()=>{
  assert.equal(currentHudToken({},()=>token),token);
});
test('GM v14 HUD button opens selected merchant and is not duplicated',()=>{
  const {root,button,container}=mockUi();
  let opened=0;
  const opts={app:{object:token},html:root,isGM:true,onOpen:t=>{assert.equal(t,token);opened++;}};
  assert.equal(injectMerchantHudControl(opts),true);
  assert.ok(button.className.includes('ns-hud-floating'));
  assert.equal(container.child,button);
  button.fire('click');
  assert.equal(opened,1);
  assert.equal(injectMerchantHudControl(opts),false);
});
test('GM v11 HUD button uses existing HUD column',()=>{
  const {root,button}=mockUi(true);
  assert.equal(injectMerchantHudControl({app:{object:token},html:[root],isGM:true,onOpen:()=>{}}),true);
  assert.ok(!button.className.includes('ns-hud-floating'));
});
test('players never receive merchant editor button',()=>{
  const {root,container}=mockUi();
  assert.equal(injectMerchantHudControl({app:{object:token},html:root,isGM:false,onOpen:()=>{}}),false);
  assert.equal(container.child,undefined);
});
test('no actor token does not get a merchant control',()=>{
  const {root}=mockUi();
  assert.equal(injectMerchantHudControl({app:{object:{document:{}}},html:root,isGM:true,onOpen:()=>{}}),false);
});

test('GM does not receive merchant HUD button on player characters (v11 and v14)',()=>{
  for(const classic of [false,true]) {
    const {root,container}=mockUi(classic);
    assert.equal(injectMerchantHudControl({app:{object:pcToken},html:root,isGM:true,onOpen:()=>{throw Error('PC merchant opened');}}),false);
    assert.equal(container.child,undefined);
  }
});
test('HUD click rejects an NPC token that becomes a character',()=>{
  const {root,button}=mockUi();
  const mutable={actor:{type:'npc'},document:{actorId:'npc-a'}};
  let calls=0;
  assert.equal(injectMerchantHudControl({app:{object:mutable},html:root,isGM:true,onOpen:()=>calls++}),true);
  mutable.actor.type='character';
  button.fire('click');
  assert.equal(calls,0);
});

test('shop button inserts immediately BELOW Elevation in both v11 and v14 HUDs',()=>{
 for(const classic of [true,false]){
  const {root,button}=mockUi(classic);
  const elevation={nextSibling:{name:'next'}};
  const calls=[];
  elevation.parentNode={insertBefore:(element,next)=>calls.push({element,next})};
  const original=root.querySelector.bind(root);
  root.querySelector=selector=>selector==='[data-action="elevation"]'?elevation:original(selector);
  assert.equal(injectMerchantHudControl({
   app:{object:token},html:classic?[root]:root,isGM:true,onOpen:()=>{}
  }),true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].element,button);
  assert.equal(calls[0].next,elevation.nextSibling);
  assert.ok(!button.className.includes('ns-hud-floating'));
 }
});
test('shop control uses left HUD column as fallback in v11 without explicit Elevation node',()=>{
 const {root,button,container}=mockUi(true);
 assert.equal(injectMerchantHudControl({app:{object:token},html:root,isGM:true,onOpen:()=>{}}),true);
 assert.equal(container.child,button);
 assert.ok(!button.className.includes('ns-hud-floating'));
});
