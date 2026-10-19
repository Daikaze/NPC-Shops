import test from 'node:test';
import assert from 'node:assert/strict';
import {gpToCp, cpToGp, moneyTotal, moneyBreakdown, changeWallet, itemPriceCp, emptyShop, assertInt} from '../src/core.js';
test('currency conversions use integer copper and all denominations', () => {
  assert.equal(moneyTotal({pp:1,gp:1,ep:1,sp:1,cp:1}),1161);
  assert.deepEqual(moneyBreakdown(1161),{pp:1,gp:1,ep:1,sp:1,cp:1});
  assert.equal(moneyTotal(changeWallet({gp:1},-30)),70);
});
test('refuses overspending and invalid numbers', () => {
  assert.throws(() => changeWallet({gp:1},-101),/Insufficient/);
  assert.throws(() => assertInt(1.2),/Invalid/);
  assert.throws(() => moneyTotal({gp:-1}),/Invalid/);
});
test('price is precise to a copper', () => {
  assert.equal(gpToCp('12.34'),1234);
  assert.equal(cpToGp(1234),'12.34');
  assert.throws(() => gpToCp('0.001'));
  assert.equal(itemPriceCp({system:{price:{value:2,denomination:'sp'}}}),20);
  assert.equal(emptyShop().sellRate,0.5);
});
