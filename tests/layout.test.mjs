import test from 'node:test';
import assert from 'node:assert/strict';
import {clampButtonPosition,clampShopFrame,shopSizeLayout} from '../src/layout.js';

test('movable button is constrained to the available screen', () => {
  assert.deepEqual(clampButtonPosition({x:99999,y:-4},1024,768,110,36),{x:906,y:8});
  assert.deepEqual(clampButtonPosition({x:31,y:37},1024,768,110,36),{x:31,y:37});
});
test('manifest enables relay for shared GM shopping requests', async () => {
  const {readFile} = await import('node:fs/promises');
  const manifest=JSON.parse(await readFile(new URL('../module.json',import.meta.url),'utf8'));
  assert.equal(manifest.socket,true);
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(manifest.version,pkg.version);
});

test('shop resizing preserves independently dragged width and height', () => {
  assert.deepEqual(clampShopFrame({left:80,top:60,width:800,height:440},1280,800),
    {left:80,top:60,width:800,height:440});
  assert.deepEqual(clampShopFrame({left:80,top:60,width:600,height:440},1280,800),
    {left:80,top:60,width:600,height:440});
  assert.deepEqual(clampShopFrame({left:80,top:60,width:600,height:360},1280,800),
    {left:80,top:60,width:600,height:360});
});
test('shop resize grip stays inside the viewport, including narrow screens', () => {
  assert.deepEqual(clampShopFrame({left:1100,top:700,width:650,height:500},1280,800),
    {left:622,top:292,width:650,height:500});
  assert.deepEqual(clampShopFrame({left:8,top:8,width:50,height:50},1280,800),
    {left:8,top:8,width:350,height:300});
  assert.deepEqual(clampShopFrame({left:0,top:0,width:1000,height:900},320,240),
    {left:8,top:8,width:304,height:224});
});
test('shop layout changes with merchant window width instead of viewport width', () => {
  assert.equal(shopSizeLayout(1000),'wide');
  assert.equal(shopSizeLayout(849),'medium');
  assert.equal(shopSizeLayout(539),'compact');
  assert.equal(shopSizeLayout(350),'compact');
});
