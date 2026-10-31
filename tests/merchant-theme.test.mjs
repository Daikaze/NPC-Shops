import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('storefront has responsive three-panel layout and no third-party asset dependency',()=>{
 const ui=readFileSync(new URL('../src/merchant-view.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../styles/npc-shops.css',import.meta.url),'utf8');
 assert.match(ui,/BILL OF SALE/);
 assert.match(ui,/ns-mp-hero/);
 assert.match(ui,/ns-mp-sidebar/);
 assert.match(css,/grid-template-columns:180px minmax/);
 assert.ok(!ui.includes('raw.githubusercontent.com/mikiross87'));
});

test('V11 legacy palette is retained and V14 native theme is loaded last',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../module.json',import.meta.url),'utf8'));
 assert.equal(manifest.styles.at(-3),'styles/merchant-presets-look.css');
 assert.equal(manifest.styles.at(-2),'styles/merchant-tables.css');
 assert.equal(manifest.styles.at(-1),'styles/native-v14.css');
 const native=readFileSync(new URL('../styles/native-v14.css',import.meta.url),'utf8');
 assert.match(native,/\\.application\\.npc-shops-native/);
 assert.match(native,/\\.window-content/);
 assert.ok(!native.includes('@import'));
 const css=readFileSync(new URL('../styles/merchant-presets-look.css',import.meta.url),'utf8');
 assert.match(css,/#311b1f/);
 assert.match(css,/#491d25/);
 assert.match(css,/#252830/);
 assert.match(css,/#2b2721/);
 assert.match(css,/grid-template-columns:178px minmax\(0,1fr\) 278px/);
 assert.match(css,/\.ns-mp-seal/);
 assert.match(css,/\.ns-mp-item>img/);
 assert.match(css,/\.ns-save-all-bar/);
 assert.match(css,/\.npc-shops-window/);
 assert.ok(!css.includes('@import')); assert.ok(!css.includes('https://'));

});
test('new hero, copper coin accents, bill wax stamp, and original actions coexist',async()=>{
 const {renderMerchantView}=await import('../src/merchant-view.js');
 const w={
  mode:'buy',gm:true,eligibleBuyers:[],cart:{buy:new Map(),sell:new Map()},
  categoryFilter:{buy:'all',sell:'all'},searchQueries:{buy:'',sell:'',manage:''},
  busy:false,name:'Kiro',settingsPage:'stock',renderManage:()=>'<section>Manage stock</section>'
 };
 globalThis.game={version:'14'};
 const shop={enabled:true,open:true,allowSelling:true,sellRate:.5,stock:[{
   id:'stock',item:{name:'Wand',type:'weapon',system:{rarity:'Uncommon',weight:1}},priceCp:400,quantity:3
 }],ledger:[]};
 const html=renderMerchantView(w,shop,null,'Kiro','npc.png');
 assert.match(html,/ns-mp-hero/);
 assert.match(html,/ns-mp-picker/);
 assert.match(html,/ns-mp-money/);
 assert.match(html,/ns-mp-seal/);
 assert.match(html,/BILL OF SALE/);
 assert.match(html,/ns-mp-stock-label/);
 assert.match(html,/3 left/);
 assert.match(html,/data-action="cart-add"/);
 assert.match(html,/data-action="cart-checkout"/);
 assert.match(html,/data-action="tab-manage"/);
 assert.match(html,/data-field="item-search"/);
});

test('every native shop select and expanded option uses contrasting dark colors',()=>{
 const css=readFileSync(new URL('../styles/merchant-presets-look.css',import.meta.url),'utf8');
 assert.match(css,/color-scheme:\s*dark\s*!important/);
 assert.match(css,/select option,\s*\.npc-shops-window:not\(\.ns-directory\) select optgroup/);
 assert.match(css,/select option:checked/);
 assert.match(css,/select option:disabled/);
 assert.match(css,/\.ns-mp-purse select\s*\{[\s\S]*?background:\s*#352229\s*!important/);
 assert.match(css,/background-color:\s*#252830\s*!important/);
 assert.match(css,/color:\s*#f4f5f8\s*!important/);
});

test('floating Shops launcher stays behind regular Foundry sheets',()=>{
 const css=readFileSync(new URL('../styles/npc-shops.css',import.meta.url),'utf8');
 const launcher=css.match(/\.npc-shops-access\s*\{([^}]+)\}/)?.[1];
 const shop=css.match(/\.npc-shops-window\s*\{([^}]+)\}/)?.[1];
 assert.ok(launcher,'Shops launcher style must exist');
 assert.ok(shop,'Shop window style must exist');
 const launcherZ=Number(launcher.match(/z-index:\s*(-?\d+)/)?.[1]);
 const shopZ=Number(shop.match(/z-index:\s*(-?\d+)/)?.[1]);
 assert.equal(launcherZ,20);
 assert.ok(launcherZ<shopZ,'floating launcher must not cover its own shop');
 assert.ok(launcherZ<100,'floating launcher must not cover normal Foundry window layers');
 assert.doesNotMatch(launcher,/z-index:\s*510/);
});
