import test from "node:test";
import assert from "node:assert/strict";
import {supportsNativeWindows,createNativeFrame} from "../src/native-window.js";

test("V14 native ApplicationV2 is used only when V14 is available", async () => {
  const oldGame = globalThis.game;
  const oldFoundry = globalThis.foundry;
  const oldDocument = globalThis.document;
  try {
    class FakeApplicationV2 {
      static DEFAULT_OPTIONS = {};
      constructor(options) { this.options = options; }
      _onClose() { this.coreClosed = true; }
    }
    globalThis.foundry = {applications:{api:{ApplicationV2:FakeApplicationV2}}};
    globalThis.game = {release:{generation:11},version:"11.315"};
    assert.equal(supportsNativeWindows(),false);
    assert.equal(createNativeFrame({id:"legacy",title:"Legacy"}),null);

    globalThis.game = {release:{generation:14},version:"14.368"};
    globalThis.document = {createElement(tag) {
      return {tagName:tag.toUpperCase(),className:"",attributes:{},
        setAttribute(k,v) {this.attributes[k]=v;}};
    }};
    assert.equal(supportsNativeWindows(),true);
    let closed = 0;
    const native = createNativeFrame({
      id:"npc-shops-merchant-test",title:"NPC Shops · Test",width:1030,height:740,
      onClose:()=>closed++
    });
    assert.equal(native.options.window.title,"NPC Shops · Test");
    assert.equal(native.options.position.width,1030);
    assert.equal(native.constructor.DEFAULT_OPTIONS.window.resizable,true);
    assert.equal(native.constructor.DEFAULT_OPTIONS.window.minimizable,true);
    assert.ok(native.constructor.DEFAULT_OPTIONS.classes.includes("npc-shops-native"));
    const result = await native._renderHTML();
    assert.equal(result.className,"npc-shops-window");
    const content = {replaceChildren(element) { this.child=element; }};
    native._replaceHTML(result,content);
    assert.equal(content.child,result);
    native._onClose({});
    assert.equal(closed,1);
    assert.equal(native.coreClosed,true);
  } finally {
    if(oldGame===undefined)delete globalThis.game; else globalThis.game=oldGame;
    if(oldFoundry===undefined)delete globalThis.foundry; else globalThis.foundry=oldFoundry;
    if(oldDocument===undefined)delete globalThis.document; else globalThis.document=oldDocument;
  }
});
