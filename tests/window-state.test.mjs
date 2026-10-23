import test from 'node:test';
import assert from 'node:assert/strict';
import {captureWindowState,restoreWindowState} from '../src/window-state.js';
function el(mainScroll=0,itemsScroll=0){
 const main={scrollTop:mainScroll};
 const items={dataset:{scrollKey:'compendium-items'},scrollTop:itemsScroll};
 const comp={dataset:{persist:'compendium'},open:true};
 const ledger={dataset:{persist:'ledger'},open:false};
 return {
  main,items,comp,ledger,
  querySelector(s){return s==='.ns-content'?main:null;},
  querySelectorAll(s){
   if(s==='[data-scroll-key]')return [items];
   if(s==='details[data-persist]')return [comp,ledger];
   return [];
  }
 };
}
test('re-render restores scrolling in main and nested Compendium list',()=>{
 const state=new Map(),before=el(620,132);
 captureWindowState(before,'manage',state);
 const after=el();
 restoreWindowState(after,'manage',state);
 assert.equal(after.main.scrollTop,620);
 assert.equal(after.items.scrollTop,132);
 assert.equal(after.comp.open,true);
});
test('per-tab scroll positions are independent and panel open state survives',()=>{
 const state=new Map();
 const buy=el(290,0),manage=el(530,190);
 manage.comp.open=false;manage.ledger.open=true;
 captureWindowState(buy,'buy',state);captureWindowState(manage,'manage',state);
 const toBuy=el(),toManage=el();
 restoreWindowState(toBuy,'buy',state);
 restoreWindowState(toManage,'manage',state);
 assert.equal(toBuy.main.scrollTop,290);
 assert.equal(toManage.main.scrollTop,530);
 assert.equal(toManage.items.scrollTop,190);
 assert.equal(toManage.comp.open,false);
 assert.equal(toManage.ledger.open,true);
});
test('no-op safely before ShopWindow element is mounted, including minimal mocks',()=>{
 const state=new Map();
 captureWindowState(null,'manage',state);
 captureWindowState({innerHTML:''},'buy',state);
 restoreWindowState({innerHTML:''},'buy',state);
 assert.equal(state.size,0);
});
