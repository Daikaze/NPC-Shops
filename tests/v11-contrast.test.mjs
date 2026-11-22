import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const v11=readFileSync(new URL('../styles/v11-contrast-fix.css',import.meta.url),'utf8');
const native=readFileSync(new URL('../styles/native-v14.css',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../module.json',import.meta.url),'utf8'));
const selectors = [
  '.npc-shops-window.ns-modern-v11',
  '.npc-shops-window.ns-modern-v11 .ns-native-summary',
  '.npc-shops-window.ns-modern-v11 .ns-mp-sidebar',
  '.npc-shops-window.ns-modern-v11 .ns-mp-main',
  '.npc-shops-window.ns-modern-v11 .ns-mp-bill',
  '.npc-shops-window.ns-modern-v11 .ns-item.ns-mp-item',
  '.npc-shops-window.ns-modern-v11 .ns-coin-inputs .ns-coin-input input[type="number"]'
];
const luminance = color => {
  const channels = color.match(/[a-f0-9]{2}/ig).map(hex=>parseInt(hex,16)/255);
  const corrected=channels.map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return corrected[0]*.2126+corrected[1]*.7152+corrected[2]*.0722;
};
const contrast=(a,b)=>{
 const [top,bottom]=[luminance(a),luminance(b)].sort((a,b)=>b-a);
 return (top+.05)/(bottom+.05);
};
test('Foundry V11 contrast stylesheet overrides old theme last, not V14',()=>{
 assert.equal(manifest.styles.at(-1),'styles/v11-contrast-fix.css');
 assert.equal(manifest.version,'0.5.8');
 for(const selector of selectors)assert.ok(v11.includes(selector),selector);
 assert.match(v11,/color-scheme:\s*dark\s*!important/);
 assert.doesNotMatch(v11,/\.application\.npc-shops-native/);
 assert.match(native,/\.application\.npc-shops-native/);
});
test('the V11 background and foreground maintain accessible high contrast',()=>{
 assert.ok(contrast('#1d2530','#f0f2f6')>=10,'Root V11 text must be readable');
 assert.ok(contrast('#28313e','#edf1f6')>=9,'V11 item rows must be readable');
 assert.ok(contrast('#202a38','#f8fafc')>=10,'PP/GP/SP/CP input values must be readable');
 assert.match(v11,/--color-bg:\s*#1d2530/);
 assert.match(v11,/--color-bg-option:\s*#27313e/);
 assert.match(v11,/--input-background-color:\s*#202a37/);
 assert.match(v11,/\.ns-mp-main\s*\{\s*background:\s*#171d27\s*!important/);
});
test('GM V11 row gives the four coin fields a second full-width row',()=>{
 assert.match(v11,/grid-template-areas:\s*"item stock add" "money money money"/);
 assert.match(v11,/\.ns-buy-price-editor \.ns-coin-inputs/);
 assert.match(v11,/grid-area:\s*coins\s*!important/);
 assert.match(v11,/@container \(max-width: 730px\)/);
 assert.match(v11,/@container \(max-width: 510px\)/);
});
