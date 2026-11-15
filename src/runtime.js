export function createRuntime() {
  "use strict";
  const native = {
    add: EventTarget.prototype.addEventListener,
    remove: EventTarget.prototype.removeEventListener,
    dispatch: EventTarget.prototype.dispatchEvent,
    define: Object.defineProperty,
    descriptor: Object.getOwnPropertyDescriptor,
    apply: Reflect.apply,
    construct: Reflect.construct,
    Proxy,
    hidden: Object.getOwnPropertyDescriptor(Document.prototype, "hidden")?.get,
    visibility: Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState")?.get,
    focus: Document.prototype.hasFocus,
    raf: window.requestAnimationFrame.bind(window),
    setTimeout: window.setTimeout.bind(window)
  };
  const shield = {
    native,
    features: {},
    capabilities: {},
    mirrorNodes: new WeakSet(),
    privateAttributes: new Set(),
    failures: [],
    counts: Object.create(null),
    mutate(callback) { return callback(); },
    attribute() {
      const bytes = new Uint8Array(12);
      if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(bytes);
      else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.random() * 256;
      const name = "data-" + Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
      shield.privateAttributes.add(name);
      return name;
    },
    listen(target, type, handler, capture = true) {
      native.apply(native.add, target, [type, handler, capture]);
      return () => native.apply(native.remove, target, [type, handler, capture]);
    },
    patch(target, name, descriptor) {
      const before = native.descriptor(target, name);
      try {
        let inherited = before;
        for (let proto = Object.getPrototypeOf(target); !inherited && proto; proto = Object.getPrototypeOf(proto)) inherited = native.descriptor(proto, name);
        const replacement = { ...descriptor };
        for (const kind of ["value", "get", "set"]) {
          const implementation = replacement[kind], original = inherited?.[kind];
          if (typeof implementation !== "function" || typeof original !== "function" || implementation === original) continue;
          // Keep the original callable's name, length, properties and constructability.
          // Function.prototype.toString remains completely native; a callable Proxy is
          // represented by the engine, rather than publishing implementation source.
          let wrapper;
          wrapper = new native.Proxy(original, {
            apply(_target, receiver, args) { return native.apply(implementation, receiver, args); },
            construct(_target, args, newTarget) {
              return native.construct(implementation, args, newTarget === wrapper ? implementation : newTarget);
            }
          });
          replacement[kind] = wrapper;
        }
        native.define(target, name, { configurable: true, enumerable: false, ...before, ...replacement });
        return true;
      } catch (error) {
        shield.failures.push(`${name}: ${error.message}`);
        return false;
      }
    },
    block(event) {
      shield.counts[event.type] = (shield.counts[event.type] || 0) + 1;
      event.stopImmediatePropagation();
    },
    report() {
      return {
        installed: true,
        version: shield.version || "2.2.0",
        signature: shield.signature || "",
        href: location.href,
        features: { ...shield.features },
        capabilities: { ...shield.capabilities },
        failures: [...shield.failures],
        blocked: { ...shield.counts },
        exposed: { hidden: document.hidden, visibility: document.visibilityState, focus: document.hasFocus() },
        fullscreen: shield.fullscreen?.status() || null
      };
    }
  };
  return shield;
}
