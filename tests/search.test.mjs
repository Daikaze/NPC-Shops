import test from 'node:test';
import assert from 'node:assert/strict';
import {ShopWindow, matchesItemSearch} from '../src/ui.js';

test('item search ignores case and surrounding query whitespace', () => {
  assert.equal(matchesItemSearch('Longsword +1', 'sWoRd'), true);
  assert.equal(matchesItemSearch('Potion of Healing', '  HEAL  '), true);
  assert.equal(matchesItemSearch('Potion of Healing', ''), true);
  assert.equal(matchesItemSearch('Potion of Healing', '   '), true);
  assert.equal(matchesItemSearch('Potion of Healing', 'axe'), false);
  assert.equal(matchesItemSearch(undefined, 'axe'), false);
});

test('GM has a search field in Buy, Sell, Manage with independent tab values', () => {
  const shop={enabled:true,open:true,allowSelling:true,sellRate:0.5,stock:[{id:'s1',item:{name:'Longsword',type:'weapon'},priceCp:100,quantity:2,unlimited:false}],ledger:[]};
  const npc={id:'merchant-search',name:'Merchant',type:'npc',getFlag:()=>shop};
  const prior=globalThis.game;
  try {
    globalThis.game={user:{id:'gm',isGM:true},version:'14',actors:{contents:[],get:()=>npc}};
    const win=new ShopWindow(npc,async()=>{},async()=>{});
    win.element={innerHTML:''};
    for(const mode of ['buy','sell','manage']){
      win.mode=mode;
      win.render();
      assert.match(win.element.innerHTML, /data-field="item-search"/);
      assert.match(win.element.innerHTML, /placeholder="Search items\.\.\."/);
    }
    win.searchQueries.buy='Sword';
    win.mode='buy';win.render();
    assert.match(win.element.innerHTML,/value="Sword"/);
    win.mode='manage';win.render();
    assert.doesNotMatch(win.element.innerHTML,/value="Sword"/);
  } finally { globalThis.game=prior; }
});

test('live filtering hides unmatched rows and empty categories, then restores them', () => {
  const makeRow=name=>({
    hidden:false,
    querySelector:selector=>selector==='.ns-itemtext strong'?{textContent:name}:null
  });
  const sword=makeRow('Longsword'), dagger=makeRow('Dagger'), potion=makeRow('Healing Potion');
  const makeCategory=rows=>{
    const count={textContent:''};
    return {
      count,
      hidden:false,
      querySelectorAll:selector=>selector==='.ns-item'?rows:[],
      querySelector:selector=>selector==='.ns-category-count'?count:null
    };
  };
  const weapons=makeCategory([sword,dagger]), consumables=makeCategory([potion]);
  const noResults={hidden:true};
  const fakeElement={
    querySelectorAll:selector=>selector==='.ns-items .ns-category'?[weapons,consumables]:[],
    querySelector:selector=>selector==='.ns-no-results'?noResults:null
  };
  const win=new ShopWindow({id:'m'},()=>{},()=>{});
  win.element=fakeElement;
  win.searchQueries.buy='sword';
  win.applySearchFilter();
  assert.equal(sword.hidden,false);
  assert.equal(dagger.hidden,true);
  assert.equal(potion.hidden,true);
  assert.equal(weapons.hidden,false);
  assert.equal(consumables.hidden,true);
  assert.equal(weapons.count.textContent,'1 item');
  assert.equal(consumables.count.textContent,'0 items');
  assert.equal(noResults.hidden,true);

  win.searchQueries.buy='no such item';
  win.applySearchFilter();
  assert.equal(weapons.hidden,true);
  assert.equal(consumables.hidden,true);
  assert.equal(noResults.hidden,false);

  win.searchQueries.buy='';
  win.applySearchFilter();
  assert.equal(sword.hidden,false);
  assert.equal(dagger.hidden,false);
  assert.equal(potion.hidden,false);
  assert.equal(weapons.hidden,false);
  assert.equal(consumables.hidden,false);
  assert.equal(noResults.hidden,true);
});

test('input event only filters the existing DOM, preserving edited inputs', () => {
  const handlers={};
  const el={addEventListener:(type,handler)=>{handlers[type]=handler;}};
  const win=new ShopWindow({id:'m'},()=>{},()=>{});
  let filterCalls=0,renderCalls=0;
  win.applySearchFilter=()=>{filterCalls++;};
  win.render=()=>{renderCalls++;};
  win.bindEvents(el);
  handlers.input({target:{value:'dagger',matches:s=>s==='[data-field="item-search"]'}});
  assert.equal(win.searchQueries.buy,'dagger');
  assert.equal(filterCalls,1);
  assert.equal(renderCalls,0);
  handlers.input({target:{value:'5',matches:()=>false}});
  assert.equal(filterCalls,1);
});
