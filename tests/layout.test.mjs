import test from 'node:test';
import assert from 'node:assert/strict';
import {shopPinFromToken, validShopPin, pinScreenPoint, clampButtonPosition} from '../src/layout.js';
test('shop pin stays at placement even if token later moves', () => {
  const token={x:100,y:220,width:2};
  const saved=shopPinFromToken(token,100);
  token.x=500; token.y=800;
  assert.deepEqual(saved,{x:200,y:220});
  assert.notDeepEqual(saved,shopPinFromToken(token,100));
});
test('screen projection accounts for CSS sizing and canvas scaling', () => {
  const p=pinScreenPoint({x:200,y:220}, ({x,y})=>({x:x*1.5+10,y:y*1.5+20}), {left:80,top:90,width:1000,height:500}, 2000,1000);
  assert.deepEqual(p,{x:235,y:265});
  assert.equal(validShopPin({x:1,y:NaN}),false);
});
test('movable button is constrained to the available screen', () => {
  assert.deepEqual(clampButtonPosition({x:99999,y:-4},1024,768,110,36),{x:906,y:8});
  assert.deepEqual(clampButtonPosition({x:31,y:37},1024,768,110,36),{x:31,y:37});
});
test('manifest enables relay for shared GM shopping requests', async () => {
  const {readFile}=await import('node:fs/promises');
  const manifest=JSON.parse(await readFile(new URL('../module.json',import.meta.url),'utf8'));
  assert.equal(manifest.socket,true);
  assert.equal(manifest.version,'0.1.2');
});
