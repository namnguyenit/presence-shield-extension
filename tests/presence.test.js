import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";

function realm() {
  const context = vm.createContext({ console, setTimeout });
  vm.runInContext(`
    class EventTarget {
      constructor() { this.listeners = new Map(); }
      addEventListener(type, listener) { const items = this.listeners.get(type) || []; items.push(listener); this.listeners.set(type, items); }
      removeEventListener(type, listener) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== listener)); }
      dispatchEvent(event) { event.target ||= this; for (const listener of this.listeners.get(event.type) || []) { listener.call(this, event); if (event.stopped) break; } return true; }
    }
    class Document extends EventTarget {
      get hidden() { if (!(this instanceof Document)) throw new TypeError('receiver'); return true; }
      get visibilityState() { if (!(this instanceof Document)) throw new TypeError('receiver'); return 'hidden'; }
      hasFocus() { if (!(this instanceof Document)) throw new TypeError('receiver'); return false; }
    }
    const window = new EventTarget(); const document = new Document();
    const location = { href: 'https://test.example/' };
    window.requestAnimationFrame = () => 1; window.setTimeout = setTimeout;
    function send(type, target) { const event = { type, target, stopImmediatePropagation() { this.stopped = true; } }; window.dispatchEvent(event); return event; }
  `, context);
  for (const file of ["runtime", "presence"]) vm.runInContext(fs.readFileSync(new URL(`../src/${file}.js`, import.meta.url), "utf8").replace(/^export /gm, ""), context);
  vm.runInContext("const shield = createRuntime(); installPresence(shield);", context);
  return context;
}
test("exposed values stay visible/focused while retained native readings differ", () => {
  const context = realm();
  assert.equal(vm.runInContext("document.hidden", context), false);
  assert.equal(vm.runInContext("document.visibilityState", context), "visible");
  assert.equal(vm.runInContext("Document.prototype.hasFocus.call(document)", context), true);
  assert.equal(vm.runInContext("shield.native.hidden.call(document)", context), true);
  assert.throws(() => vm.runInContext("Document.prototype.hasFocus.call({})", context));
});
test("window activity events are suppressed but field focus events survive", () => {
  const context = realm();
  vm.runInContext("let count = 0; window.addEventListener('blur', () => count++); send('blur', window)", context);
  assert.equal(vm.runInContext("count", context), 0);
  vm.runInContext("send('blur', { tagName: 'INPUT' })", context);
  assert.equal(vm.runInContext("count", context), 1);
});
