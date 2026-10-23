/** Preserve per-tab scrolling and expanded panels across full ShopWindow HTML re-renders.
 * Avoid leaking DOM references into long-lived window state.
 */
export function captureWindowState(element, mode, store) {
  if(!element||!mode)return;
  const main=element.querySelector?.('.ns-content');
  if(main)store.set(mode+':main',Math.max(0,Number(main.scrollTop)||0));
  for(const pane of element.querySelectorAll?.('[data-scroll-key]')??[]) {
    if(pane.dataset?.scrollKey)
      store.set(mode+':scroll:'+pane.dataset.scrollKey,Math.max(0,Number(pane.scrollTop)||0));
  }
  for(const section of element.querySelectorAll?.('details[data-persist]')??[]){
    if(section.dataset?.persist)
      store.set(mode+':open:'+section.dataset.persist,!!section.open);
  }
}
export function restoreWindowState(element, mode, store) {
  if(!element||!mode)return;
  const main=element.querySelector?.('.ns-content');
  if(main)main.scrollTop=store.get(mode+':main')??0;
  for(const pane of element.querySelectorAll?.('[data-scroll-key]')??[]) {
    if(pane.dataset?.scrollKey)
      pane.scrollTop=store.get(mode+':scroll:'+pane.dataset.scrollKey)??0;
  }
  for(const section of element.querySelectorAll?.('details[data-persist]')??[]) {
    const key=mode+':open:'+section.dataset?.persist;
    if(store.has(key))section.open=store.get(key);
  }
}
