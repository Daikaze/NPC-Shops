import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyShop,formatPriceCoins,legacyPriceCoins,priceCoinsForEntry,priceCoinsTotal,
  publicShop,stockCopy
} from '../src/core.js';
import {coinEditor,readCoinEditor} from '../src/coin-inputs.js';
import {setBuyPrice,collectStockEdits,applyStockEdits,setUnlimitedForAll} from '../src/manage-stock.js';
import {cartLines,cartTotal} from '../src/merchant-cart.js';
import {renderMerchantView} from '../src/merchant-view.js';
import {tradeReceiptContent} from '../src/chat.js';

const counts = (pp=0,gp=0,sp=0,cp=0)=>({pp,gp,sp,cp});
const item=(name='Potion')=>({name,type:'consumable',img:'potion.png',
  system:{quantity:1,price:{value:10,denomination:'gp'}}});
const makeShop=(entry)=>({...emptyShop(),enabled:true,open:true,sellRate:.5,
  stock:[entry],ledger:[]});

function rowFor(id,amounts,stock=4,unlimited=false) {
 const fields={stock:{value:String(stock)},unlimited:{checked:unlimited}};
 return {dataset:{sku:id},querySelector(selector) {
   const field=selector.match(/^\[data-coin-field="([^"]+)"\]\[data-coin="([^"]+)"\]$/);
   if(field)return field[1]==='price' ? {value:String(amounts[field[2]])}:null;
   const name=selector.match(/^\[data-field="([^"]+)"\]$/);
   return fields[name?.[1]] ?? null;
 }};
}

test('typed 10 GP remains 10 GP rather than 1 PP after Buy Save',()=>{
 const old=makeShop({id:'p',item:item(),priceCp:100,priceCoins:counts(0,1,0,0),quantity:10,unlimited:false});
 const changed=setBuyPrice(old,'p',{totalCp:1000,parts:counts(0,10,0,0)});
 assert.equal(changed.stock[0].priceCp,1000);
 assert.deepEqual(changed.stock[0].priceCoins,counts(0,10,0,0));
 assert.equal(changed.stock[0].priceCoins.pp,0);
 assert.equal(formatPriceCoins(priceCoinsForEntry(changed.stock[0])),'10 gp');
 assert.match(coinEditor('buy-price',priceCoinsForEntry(changed.stock[0])),/data-coin="gp"[^>]*value="10"/);
 assert.match(coinEditor('buy-price',priceCoinsForEntry(changed.stock[0])),/data-coin="pp"[^>]*value="0"/);
 assert.equal(old.stock[0].priceCp,100);
});

test('large values in EACH coin field remain in that field after Stock Save All',()=>{
 const initial=makeShop({id:'p',item:item(),priceCp:100,quantity:4,unlimited:false});
 const amounts=counts(2,17,35,120);
 const changes=collectStockEdits([rowFor('p',amounts)]);
 const result=applyStockEdits(initial,changes);
 const saved=result.shop.stock[0];
 assert.deepEqual(saved.priceCoins,amounts);
 assert.equal(saved.priceCp,2*1000+17*100+35*10+120);
 assert.equal(result.changed,1);
 assert.deepEqual(priceCoinsForEntry(saved),amounts);
 const rendered=coinEditor('price',priceCoinsForEntry(saved));
 for(const [coin,count] of Object.entries(amounts))
   assert.match(rendered,new RegExp('data-coin="'+coin+'"[^>]*value="'+count+'"'));
 assert.equal(formatPriceCoins(saved.priceCoins),'2 pp 17 gp 35 sp 120 cp');
 assert.equal(priceCoinsTotal(saved.priceCoins),saved.priceCp);
 const afterUnlimited=setUnlimitedForAll(result.shop,true);
 assert.deepEqual(afterUnlimited.stock[0].priceCoins,amounts);
});

test('saving same copper total with different entered coins is a real edit',()=>{
 const original=makeShop({id:'p',item:item(),priceCp:1000,priceCoins:counts(1,0,0,0),quantity:3,unlimited:false});
 const edits=collectStockEdits([rowFor('p',counts(0,10,0,0),3)]);
 const updated=applyStockEdits(original,edits);
 assert.equal(updated.shop.stock[0].priceCp,1000);
 assert.equal(updated.changed,1);
 assert.deepEqual(updated.shop.stock[0].priceCoins,counts(0,10,0,0));
});

test('old GP/SP/CP prices recover without automatically becoming PP',()=>{
 assert.deepEqual(legacyPriceCoins(1000,'gp'),counts(0,10,0,0));
 assert.deepEqual(legacyPriceCoins(1000,'sp'),counts(0,0,100,0));
 assert.deepEqual(legacyPriceCoins(1000,'cp'),counts(0,0,0,1000));
 assert.deepEqual(legacyPriceCoins(1055,'gp'),counts(0,10,5,5));
 assert.deepEqual(priceCoinsForEntry({priceCp:1000,priceDenomination:'gp'}),counts(0,10,0,0));
 assert.deepEqual(priceCoinsForEntry({priceCp:1000,item:{system:{price:{denomination:'sp'}}}}),counts(0,0,100,0));
 assert.deepEqual(priceCoinsForEntry({priceCp:1000,priceDenomination:'gp',
   priceCoins:counts(1,0,0,0)}),counts(1,0,0,0));
 assert.deepEqual(priceCoinsForEntry({priceCp:1000,priceDenomination:'gp',
   priceCoins:counts(1,10,0,0)}),counts(0,10,0,0));
});

test('new items imported from item sheet remember their original GP instead of PP',()=>{
 const copy=stockCopy(item(),3);
 assert.equal(copy.priceCp,1000);
 assert.deepEqual(copy.priceCoins,counts(0,10,0,0));
 assert.equal(copy.priceDenomination,'gp');
});

test('players see exact entered price without hidden stock counts',()=>{
 const shop=makeShop({id:'p',item:item(),priceCp:1000,quantity:4,unlimited:false,
   priceCoins:counts(0,10,0,0),priceDenomination:'gp'});
 const publicData=publicShop(shop);
 assert.deepEqual(publicData.stock[0].priceCoins,counts(0,10,0,0));
 assert.equal(publicData.stock[0].quantity,undefined);
 assert.equal(publicData.stock[0].unlimited,undefined);
 const previous=globalThis.game;
 try {
  for(const version of ['11','14']) {
   globalThis.game={version};
   const props={name:'Merchant',mode:'buy',gm:false,unifiedInterface:true,
    eligibleBuyers:[],categoryFilter:{buy:'all',sell:'all'},searchQueries:{buy:'',sell:''},
    cart:{buy:new Map([['p',2]]),sell:new Map()},busy:false};
   const buyer={name:'Hero',id:'hero',system:{currency:{gp:50}}};
   const html=renderMerchantView(props,publicData,buyer,'Merchant','merchant.png');
   assert.match(html,/data-entry-id="p"/);
   assert.match(html,/10<\/b><small>GP<\/small>/);
   assert.match(html,/20<\/b><small>GP<\/small>/);
   assert.doesNotMatch(html,/>1<\/b><small>PP<\/small>/);
   const lines=cartLines(props.cart.buy,publicData,buyer,'buy');
   assert.equal(cartTotal(lines),2000);
   assert.deepEqual(lines[0].priceCoins,counts(0,10,0,0));
  }
 } finally {globalThis.game=previous;}
});

test('chat receipts respect original GP pricing, while old receipts still work',()=>{
 const receipt={kind:'buy',buyerName:'Hero',userName:'Player',merchantName:'Mura',
  itemName:'Potion',quantity:2,totalCp:2000,totalPriceCoins:counts(0,20,0,0)};
 assert.match(tradeReceiptContent(receipt),/20 gp/);
 assert.doesNotMatch(tradeReceiptContent(receipt),/2 pp/);
 assert.match(tradeReceiptContent({...receipt,totalPriceCoins:undefined}),/2 pp/);
});

test('input parser validates exact totals and cannot save malformed coin metadata',()=>{
 const one=makeShop({id:'p',item:item(),priceCp:1000,quantity:2});
 assert.throws(()=>setBuyPrice(one,'p',{totalCp:1000,parts:counts(0,11,0,0)}),/do not match/);
 assert.throws(()=>setBuyPrice(one,'p',{totalCp:1000,parts:counts(0,-1,0,0)}));
 assert.equal(readCoinEditor(rowFor('p',counts(0,10,0,0)),'price').totalCp,1000);
});
