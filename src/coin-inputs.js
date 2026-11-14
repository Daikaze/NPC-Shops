import {assertInt,PRICE_COINS,PRICE_DENOMINATIONS,priceToCp,walletCoins} from './core.js';

/** Four independent currency inputs instead of a denomination dropdown. */
export function splitPriceCoins(amountCp) {
  let left = assertInt(amountCp,0,Number.MAX_SAFE_INTEGER);
  const parts={};
  for(const coin of PRICE_DENOMINATIONS) {
    parts[coin]=Math.floor(left/PRICE_COINS[coin]);
    left%=PRICE_COINS[coin];
  }
  return parts;
}
export function coinEditor(prefix, initial = 0, {disabled=false}={}) {
  const amounts = typeof initial==='number' ? splitPriceCoins(initial) : walletCoins(initial);
  const names={pp:'Platinum',gp:'Gold',sp:'Silver',cp:'Copper'};
  return '<div class="ns-coin-inputs" data-money-editor="'+prefix+'">'+PRICE_DENOMINATIONS.map(coin=>
    '<label class="ns-coin-input ns-input-'+coin+'"><span>'+coin.toUpperCase()+'</span>'+
      '<input data-field="'+prefix+'" data-coin-field="'+prefix+'" data-coin="'+coin+
      '" type="number" inputmode="numeric" min="0" step="1" value="'+amounts[coin]+'"'+
      (disabled?' disabled':'')+' aria-label="'+names[coin]+' pieces"/></label>'
    ).join('')+'</div>';
}

/** Read strict integer coin counts and sum them safely in copper precision. */
export function readCoinEditor(root, prefix, {allowLegacy=false}={}) {
  const first=root?.querySelector?.('[data-coin-field="'+prefix+'"][data-coin="pp"]');
  if(!first && allowLegacy) {
    const field=root?.querySelector?.('[data-field="'+prefix+'"]');
    if(field) return {totalCp:priceToCp(field.value,'gp'),parts:null,legacy:true};
  }
  const parts={};
  let totalCp=0;
  for(const coin of PRICE_DENOMINATIONS) {
    const input=root?.querySelector?.('[data-coin-field="'+prefix+'"][data-coin="'+coin+'"]');
    if(!input)throw new Error('Missing '+coin.toUpperCase()+' input for '+prefix);
    const raw=String(input.value??'').trim();
    if(!/^\d+$/.test(raw))throw new Error(coin.toUpperCase()+' must be a non-negative whole number');
    const count=assertInt(raw,0,Number.MAX_SAFE_INTEGER);
    totalCp+=count*PRICE_COINS[coin];
    if(!Number.isSafeInteger(totalCp))throw new Error('Price exceeds safe currency limits');
    parts[coin]=count;
  }
  return {parts,totalCp,legacy:false};
}
