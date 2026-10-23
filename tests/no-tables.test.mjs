import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {emptyShop, shopData} from '../src/core.js';

const here=dirname(fileURLToPath(import.meta.url));
const ui=readFileSync(resolve(here,'../src/ui.js'),'utf8');
const css=readFileSync(resolve(here,'../styles/npc-shops.css'),'utf8');
test('Rollable Tables UI and handlers are removed',()=>{
  for(const forbidden of ['Rollable Tables','tab-tables','renderTables(','handleTableDrop(','roll-all-tables','tables.js','Import from Item Compendium','renderCompendiumBrowser','shop-extras-ui.js','import-all-compendium']) {
    assert.ok(!ui.includes(forbidden),forbidden);
  }
  assert.ok(!css.includes('.ns-table-'));
  assert.ok(!existsSync(resolve(here,'../src/tables.js')));
  assert.ok(!existsSync(resolve(here,'../src/compendium.js')));
  assert.ok(!existsSync(resolve(here,'../src/shop-extras-ui.js')));
});
test('new merchants have no table defaults',()=>{
  const shop=emptyShop();
  assert.deepEqual(shop.stock,[]);
  assert.ok(!('tables' in shop));
  assert.ok(!('autoTextLoot' in shop));
});
test('existing merchant stock survives removal',()=>{
  const stock=[{id:'old-sku',item:{name:'Gillyweed',type:'loot'},quantity:3,priceCp:400}];
  const old={enabled:true,open:true,allowSelling:true,sellRate:0.7,stock,ledger:[{kind:'buy'}],tables:[{uuid:'RollTable.abc'}]};
  const shop=shopData({getFlag:()=>old});
  assert.deepEqual(shop.stock,stock);
  assert.deepEqual(shop.ledger,old.ledger);
  assert.equal(shop.sellRate,0.7);
  assert.deepEqual(old.tables,[{uuid:'RollTable.abc'}]);
});
