import test from 'node:test';
import assert from 'node:assert/strict';
import {clampButtonPosition,clampShopFrame,shopSizeLayout,resizeShopFrame} from '../src/layout.js';
import {ShopWindow} from '../src/ui.js';

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

test('right-edge resize changes width while preserving height and window left edge',()=>{
  const start={left:100,top:100,width:800,height:500};
  const shorter=resizeShopFrame(start,-240,0,'right',1200,800);
  assert.deepEqual(shorter,{left:100,top:100,width:560,height:500});
  const taller=resizeShopFrame(start,0,130,'bottom',1200,800);
  assert.deepEqual(taller,{left:100,top:100,width:800,height:630});
  const both=resizeShopFrame(start,-240,-90,'bottom-right',1200,800);
  assert.deepEqual(both,{left:100,top:100,width:560,height:410});
  const left=resizeShopFrame(start,180,0,'left',1200,800);
  assert.deepEqual(left,{left:280,top:100,width:620,height:500});
});
test('right-edge resize clamps only against the reachable viewport border',()=>{
  const start={left:100,top:100,width:800,height:500};
  assert.deepEqual(resizeShopFrame(start,800,0,'right',1200,800),
    {left:100,top:100,width:1092,height:500});
  assert.deepEqual(resizeShopFrame(start,-900,0,'right',1200,800),
    {left:100,top:100,width:350,height:500});
});
test('right-side drag event actually updates explicit pixel widths',()=>{
  const oldDocument=globalThis.document;
  const oldWindow=globalThis.window;
  const listeners=new Map(),rootListeners=new Map(),styles={};
  globalThis.document={
    addEventListener:(type,handler)=>listeners.set(type,handler),
    removeEventListener:(type,handler)=>{if(listeners.get(type)===handler)listeners.delete(type);}
  };
  globalThis.window={innerWidth:1200,innerHeight:800};
  const el={
    addEventListener:(type,handler)=>rootListeners.set(type,handler),
    contains:()=>true,
    getBoundingClientRect:()=>({left:100,top:100,width:800,height:500}),
    style:{setProperty:(name,value)=>{styles[name]=value;}},
    classList:{toggle:()=>{}}
  };
  try{
    const win=new ShopWindow({actorId:'merchant'},()=>{},()=>{});
    win.element=el;
    win.makeResizable(el);
    const grip={dataset:{nsResize:'right'}};
    rootListeners.get('pointerdown')({target:{closest:()=>grip},button:0,pointerId:1,
      clientX:900,clientY:600,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}});
    listeners.get('pointermove')({pointerId:1,clientX:660,clientY:600,preventDefault(){},stopPropagation(){}});
    assert.equal(styles.width,'560px');
    assert.equal(styles.height,'500px');
    assert.equal(styles.left,'100px');
    listeners.get('pointerup')({pointerId:1});
    assert.equal(listeners.has('pointermove'),false);
  }finally{globalThis.document=oldDocument;globalThis.window=oldWindow;}
});
