export function installPassiveEvents(shield) {
  const { native } = shield;
  const types = new Set(["keydown", "keyup", "keypress", "pointermove", "pointerdown", "pointerup", "mousemove", "mousedown", "mouseup", "touchstart", "touchmove", "touchend", "copy", "cut", "paste", "contextmenu", "selectionchange", "beforeprint", "afterprint"]);
  const callbacks = new WeakMap();
  const globalTarget = target => target === window || target === document;
  const quiet = callback => {
    if (!callback || !["function", "object"].includes(typeof callback)) return callback;
    if (!callbacks.has(callback)) callbacks.set(callback, function() {
      shield.counts.passiveEvents = (shield.counts.passiveEvents || 0) + 1;
    });
    return callbacks.get(callback);
  };
  shield.patch(EventTarget.prototype, "addEventListener", { value: function(type, listener, options) {
    if (!globalTarget(this)) return native.apply(native.add, this, arguments);
    const name = String(type);
    return native.apply(native.add, this, [name, types.has(name) ? quiet(listener) : listener, options]);
  } });
  shield.patch(EventTarget.prototype, "removeEventListener", { value: function(type, listener, options) {
    if (!globalTarget(this)) return native.apply(native.remove, this, arguments);
    const name = String(type);
    return native.apply(native.remove, this, [name, types.has(name) ? callbacks.get(listener) || listener : listener, options]);
  } });
  for (const target of [Document.prototype, window]) for (const type of types) {
    const name = "on" + type;
    let descriptor;
    for (let owner = target; owner && !descriptor; owner = Object.getPrototypeOf(owner)) descriptor = native.descriptor(owner, name);
    if (!descriptor?.get || !descriptor.set) continue;
    const handlers = new WeakMap();
    shield.patch(target, name, {
      get() { const original = native.apply(descriptor.get, this, []); return handlers.has(this) ? handlers.get(this) : original; },
      set(callback) {
        const blocked = globalTarget(this), value = typeof callback === "function" ? callback : null;
        native.apply(descriptor.set, this, [blocked ? quiet(value) : callback]);
        if (blocked) handlers.set(this, value);
      }
    });
  }
  // Preserve the real selection and native copy action; mask the simple text polling path.
  const selection = window.getSelection(), originalText = Selection.prototype.toString;
  shield.patch(Selection.prototype, "toString", { value: function() {
    const text = native.apply(originalText, this, []);
    return this === selection ? "" : text;
  } });
  if (typeof window.Clipboard === "function") for (const name of ["read", "readText"]) {
    if (typeof Clipboard.prototype[name] !== "function") continue;
    shield.patch(Clipboard.prototype, name, { value: function() {
      shield.counts.clipboardRequests = (shield.counts.clipboardRequests || 0) + 1;
      return Promise.reject(new DOMException("Clipboard reads are blocked by the privacy policy", "NotAllowedError"));
    } });
  }
  shield.features.passiveEvents = true;
  shield.capabilities.passiveEvents = true;
}
