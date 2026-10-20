import test from 'node:test';
import assert from 'node:assert/strict';
import {clampButtonPosition} from '../src/layout.js';

test('movable button is constrained to the available screen', () => {
  assert.deepEqual(clampButtonPosition({x:99999,y:-4},1024,768,110,36),{x:906,y:8});
  assert.deepEqual(clampButtonPosition({x:31,y:37},1024,768,110,36),{x:31,y:37});
});
test('manifest enables relay for shared GM shopping requests', async () => {
  const {readFile} = await import('node:fs/promises');
  const manifest=JSON.parse(await readFile(new URL('../module.json',import.meta.url),'utf8'));
  assert.equal(manifest.socket,true);
  assert.equal(manifest.version,'0.1.18');
});
