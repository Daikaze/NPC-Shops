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
