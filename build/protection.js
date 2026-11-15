// Generated. Edit src/, then run npm run build.
(() => {
"use strict";
// This diagnostic channel is not a secret or an authentication boundary.
const CONTROL_EVENT = "__ps_control_2_dcb154203be74b418b7c0a29";
const VERSION = "2.2.0";

const configKey = Symbol.for("__ps_setup_2_dcb154203be74b418b7c0a29");
const config = globalThis[configKey] || {}; delete globalThis[configKey];
const probe = { action: "status", result: null };
window.dispatchEvent(new CustomEvent(CONTROL_EVENT, { detail: probe }));
if (probe.result?.version === VERSION) return;
function createRuntime() {
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

function rewritePseudos(selector, replace) {
  let output = "", quote = "", comment = false;
  for (let i = 0; i < selector.length;) {
    if (comment) {
      if (selector.slice(i, i + 2) === "*/") { output += "*/"; i += 2; comment = false; }
      else output += selector[i++];
    } else if (quote) {
      const char = selector[i++]; output += char;
      if (char === "\\" && i < selector.length) output += selector[i++];
      else if (char === quote) quote = "";
    } else if (selector.slice(i, i + 2) === "/*") { output += "/*"; i += 2; comment = true; }
    else if (selector[i] === "'" || selector[i] === '"') { quote = selector[i]; output += selector[i++]; }
    else if (selector[i] === "\\") { output += selector[i++]; if (i < selector.length) output += selector[i++]; }
    else {
      const match = selector[i] === ":" && selector[i - 1] !== ":" ? selector.slice(i).match(/^:([a-z-]+)(?![\w-])/i) : null;
      const replacement = match && replace(match[1].toLowerCase());
      if (replacement) { output += replacement; i += match[0].length; }
      else output += selector[i++];
    }
  }
  return output;
}

function installStyleTools(shield) {
  const listeners = new Set(), roots = new Set();
  const notify = () => { for (const listener of listeners) listener(); };
  shield.styles = {
    subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    roots() { return [document, ...[...roots].map(ref => ref.deref()).filter(Boolean)]; },
    sheets(root) {
      const found = new Set([...(root.styleSheets || []), ...(root.adoptedStyleSheets || [])]);
      if (root !== document) for (const node of root.querySelectorAll("style, link[rel=stylesheet]")) if (node.sheet) found.add(node.sheet);
      return [...found].filter(sheet => !shield.mirrorNodes.has(sheet.ownerNode));
    },
    addMirror(style, root) {
      shield.mirrorNodes.add(style);
      const nonce = document.querySelector("style[nonce],script[nonce]")?.nonce;
      if (nonce) style.nonce = nonce;
      (root === document ? document.head || document.documentElement : root).appendChild(style);
      if (!style.sheet) {
        const error = "stylesheet mirror: blocked or unavailable (possibly CSP)";
        if (!shield.failures.includes(error)) shield.failures.push(error);
      }
    }
  };
  const attach = Element.prototype.attachShadow;
  shield.patch(Element.prototype, "attachShadow", { writable: true, value: function attachShadow(options) {
    const root = shield.native.apply(attach, this, [options]); roots.add(new WeakRef(root)); notify(); return root;
  } });
  for (const name of ["insertRule", "deleteRule", "replace", "replaceSync"]) {
    const original = CSSStyleSheet.prototype[name];
    if (typeof original !== "function") continue;
    shield.patch(CSSStyleSheet.prototype, name, { writable: true, value: function(...args) {
      const result = shield.native.apply(original, this, args);
      if (result?.then) result.then(notify, () => {}); else notify();
      return result;
    } });
  }
  for (const name of ["setProperty", "removeProperty"]) {
    const original = CSSStyleDeclaration.prototype[name];
    shield.patch(CSSStyleDeclaration.prototype, name, { writable: true, value: function(...args) {
      const result = shield.native.apply(original, this, args);
      // Inline geometry changes do not require rebuilding stylesheet mirrors.
      if (this.parentRule) notify();
      return result;
    } });
  }
  const cssText = shield.native.descriptor(CSSStyleDeclaration.prototype, "cssText");
  if (cssText?.set) shield.patch(CSSStyleDeclaration.prototype, "cssText", {
    get: cssText.get, set(value) { shield.native.apply(cssText.set, this, [value]); if (this.parentRule) notify(); }
  });
  shield.listen(document, "load", event => { if (event.target?.tagName === "LINK") notify(); }, true);
}

function installPerformance(shield) {
  const { native } = shield;
  const typeGetter = native.descriptor(PerformanceEntry.prototype, "entryType").get;
  const filter = entries => entries.filter(entry => {
    if (native.apply(typeGetter, entry, []) !== "visibility-state") return true;
    shield.counts.visibilityEntries = (shield.counts.visibilityEntries || 0) + 1;
    return false;
  });
  for (const name of ["getEntries", "getEntriesByType", "getEntriesByName"]) {
    for (const prototype of [Performance.prototype, PerformanceObserverEntryList.prototype]) {
      const original = prototype[name];
      shield.patch(prototype, name, { writable: true, value: function(...args) {
        return filter(native.apply(original, this, args));
      } });
    }
  }
  const nativeTakeRecords = PerformanceObserver.prototype.takeRecords;
  shield.patch(PerformanceObserver.prototype, "takeRecords", { writable: true, value: function takeRecords() {
    return filter(native.apply(nativeTakeRecords, this, []));
  } });
  const NativeObserver = window.PerformanceObserver;
  const listGet = native.descriptor(PerformanceObserverEntryList.prototype, "getEntries").value;
  // listGet is already filtered above; preserving the native list keeps receiver checks intact.
  const WrappedObserver = new Proxy(NativeObserver, {
    construct(target, args, newTarget) {
      if (typeof args[0] !== "function") return Reflect.construct(target, args, newTarget);
      const callback = args[0];
      return Reflect.construct(target, [function(list, observer, options) {
        if (native.apply(listGet, list, []).length) callback.call(this, list, observer, options);
      }], newTarget);
    }
  });
  shield.patch(window, "PerformanceObserver", { writable: true, value: WrappedObserver });
  shield.features.performance = true;
  shield.capabilities.performance = NativeObserver.supportedEntryTypes.includes("visibility-state");
}

function installWakeLock(shield) {
  shield.features.wakeLock = true;
  shield.capabilities.wakeLock = Boolean(navigator.wakeLock && window.WakeLockSentinel);
  if (!shield.capabilities.wakeLock) return;
  const { native } = shield, states = new WeakMap(), owner = navigator.wakeLock;
  const prototype = WakeLockSentinel.prototype;
  const nativeRequest = WakeLock.prototype.request;
  const nativeRelease = prototype.release;
  for (const name of ["released", "type", "onrelease"]) {
    const descriptor = native.descriptor(prototype, name);
    if (!descriptor) continue;
    shield.patch(prototype, name, {
      get() {
        const state = states.get(this);
        if (!state) return native.apply(descriptor.get, this, []);
        return name === "type" ? "screen" : name === "released" ? state.released : state.onrelease;
      },
      ...(descriptor.set ? { set(value) {
        const state = states.get(this);
        if (!state) return native.apply(descriptor.set, this, [value]);
        if (state.onrelease) native.apply(native.remove, this, ["release", state.onrelease]);
        state.onrelease = typeof value === "function" ? value : null;
        if (state.onrelease) native.apply(native.add, this, ["release", state.onrelease]);
      } } : {})
    });
  }
  shield.patch(prototype, "release", { writable: true, value: function release() {
    const state = states.get(this);
    if (!state) return native.apply(nativeRelease, this, []);
    if (!state.released) {
      state.released = true;
      const sentinel = this;
      queueMicrotask(() => native.apply(native.dispatch, sentinel, [new Event("release")]));
    }
    return Promise.resolve();
  } });
  shield.patch(WakeLock.prototype, "request", { writable: true, value: function request(type = "screen") {
    if (this !== owner) return native.apply(nativeRequest, this, [type]);
    if (String(type) !== "screen") return Promise.reject(new TypeError("Unsupported wake lock type"));
    const sentinel = new EventTarget();
    Object.setPrototypeOf(sentinel, prototype);
    states.set(sentinel, { released: false, onrelease: null });
    shield.counts.wakeLockRequests = (shield.counts.wakeLockRequests || 0) + 1;
    return Promise.resolve(sentinel);
  } });
}

function installIdle(shield) {
  shield.features.idle = true;
  shield.capabilities.idle = typeof window.IdleDetector === "function";
  if (!shield.capabilities.idle) return;
  const { native } = shield, states = new WeakMap(), NativeDetector = IdleDetector;
  const prototype = NativeDetector.prototype, originalStart = prototype.start;
  for (const name of ["userState", "screenState"]) {
    const descriptor = native.descriptor(prototype, name);
    shield.patch(prototype, name, { get() {
      const original = native.apply(descriptor.get, this, []);
      const state = states.get(this);
      return state?.started ? (name === "userState" ? "active" : "unlocked") : original;
    } });
  }
  shield.patch(prototype, "start", { writable: true, value: function start(options = {}) {
    const state = states.get(this);
    if (!state) return native.apply(originalStart, this, [options]);
    if (state.started) return Promise.reject(new DOMException("Detector already started", "InvalidStateError"));
    const threshold = options?.threshold ?? 60000, signal = options?.signal;
    if (!Number.isFinite(Number(threshold)) || Number(threshold) < 60000) return Promise.reject(new TypeError("threshold must be at least 60000"));
    if (signal && !(signal instanceof AbortSignal)) return Promise.reject(new TypeError("Invalid AbortSignal"));
    if (signal?.aborted) return Promise.reject(signal.reason);
    state.started = true;
    if (signal) native.apply(native.add, signal, ["abort", () => { state.started = false; }, { once: true }]);
    queueMicrotask(() => { if (state.started) native.apply(native.dispatch, this, [new Event("change")]); });
    return Promise.resolve();
  } });
  const WrappedDetector = new Proxy(NativeDetector, {
    construct(target, args, newTarget) {
      const detector = Reflect.construct(target, args, newTarget);
      states.set(detector, { started: false });
      return detector;
    }
  });
  shield.patch(NativeDetector, "requestPermission", { writable: true, value: function requestPermission() {
    return Promise.resolve("granted"); // Virtual permission only; never request OS idle information.
  } });
  shield.patch(window, "IdleDetector", { writable: true, value: WrappedDetector });
}


function installPrivacy(shield, config) {
  const { native } = shield;
  if (config.screenInfo) {
    shield.features.screenInfo = true;
    shield.capabilities.screenInfo = "isExtended" in screen || "getScreenDetails" in window;
    const descriptor = native.descriptor(Screen.prototype, "isExtended");
    if (descriptor?.get) shield.patch(Screen.prototype, "isExtended", { get() {
      native.apply(descriptor.get, this, []); return false;
    } });
    if (typeof window.getScreenDetails === "function") shield.patch(window, "getScreenDetails", { writable: true, value: function getScreenDetails() {
      return Promise.reject(new DOMException("Screen details are blocked by the privacy policy", "NotAllowedError"));
    } });
  }
  if (config.capture) {
    shield.features.capture = true;
    shield.capabilities.capture = Boolean(navigator.mediaDevices);
    for (const name of ["getUserMedia", "getDisplayMedia"]) {
      if (typeof window.MediaDevices?.prototype[name] !== "function") continue;
      shield.patch(MediaDevices.prototype, name, { writable: true, value: function() {
        shield.counts.mediaRequests = (shield.counts.mediaRequests || 0) + 1;
        return Promise.reject(new DOMException("Media capture is blocked by the privacy policy", "NotAllowedError"));
      } });
    }
    for (const name of ["getUserMedia", "webkitGetUserMedia"]) if (typeof navigator[name] === "function") {
      shield.patch(Object.getPrototypeOf(navigator), name, { writable: true, value: function(constraints, success, error) {
        const reason = new DOMException("Media capture is blocked by the privacy policy", "NotAllowedError");
        if (typeof error === "function") queueMicrotask(() => error(reason));
      } });
    }
  }
  // Return native PermissionStatus instances, but expose only the corresponding virtual policy.
  if (!navigator.permissions) return;
  const statuses = new WeakMap(), nativeQuery = Permissions.prototype.query;
  const stateDescriptor = native.descriptor(PermissionStatus.prototype, "state");
  shield.patch(PermissionStatus.prototype, "state", { get() {
    const value = native.apply(stateDescriptor.get, this, []);
    return statuses.get(this) ?? value;
  } });
  shield.patch(Permissions.prototype, "query", { writable: true, value: async function query(descriptor) {
    const status = await native.apply(nativeQuery, this, [descriptor]);
    const name = descriptor?.name;
    const policy = config.idle && shield.capabilities.idle && name === "idle-detection" ? "granted"
      : config.screenInfo && name === "window-management" ? "denied"
      : config.capture && ["camera", "microphone", "display-capture"].includes(name) ? "denied"
      : config.passiveEvents && name === "clipboard-read" ? "denied" : null;
    if (policy) {
      statuses.set(status, policy);
      shield.listen(status, "change", event => { if (event.isTrusted) shield.block(event); });
    }
    return status;
  } });
}

function installFocusCss(shield) {
  const { native } = shield;
  const markers = Object.fromEntries(["focus", "focus-within", "focus-visible"].map(name => [name, shield.attribute()]));
  const matches = Element.prototype.matches;
  const focusGetter = native.focus;
  const marked = new Map(), mirrors = new Set(), observed = new WeakSet();
  let last = null, ring = false, timer = null;
  const rewrite = selector => rewritePseudos(selector, name => markers[name] ? "[" + markers[name] + "]" : null);
  const clearMarkers = () => {
    for (const [node, attributes] of marked) for (const [name, previous] of attributes) {
      if (previous === null) node.removeAttribute(name); else node.setAttribute(name, previous);
    }
    marked.clear();
  };
  const mark = (node, name) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;
    if (!marked.has(node)) marked.set(node, new Map());
    const saved = marked.get(node);
    if (!saved.has(name)) saved.set(name, node.getAttribute(name));
    node.setAttribute(name, "");
  };
  function update() {
    if (last && !last.isConnected) last = null;
    clearMarkers();
    if (!last) return;
    mark(last, markers.focus);
    if (ring) mark(last, markers["focus-visible"]);
    for (let node = last; node; node = node.parentElement || node.getRootNode()?.host) mark(node, markers["focus-within"]);
  }
  function remember(target) {
    if (!target || target.nodeType !== Node.ELEMENT_NODE) return;
    let node = target;
    while (node.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
    // body can be activeElement without actually matching :focus.
    if (!native.apply(matches, node, [":focus"]) && node === document.body) { last = null; update(); return; }
    last = node;
    ring = native.apply(matches, node, [":focus-visible"]);
    update();
  }
  function mirrorRules(rules) {
    let css = "";
    for (const rule of rules) {
      if (rule.selectorText) {
        const selector = rewrite(rule.selectorText);
        if (selector !== rule.selectorText) css += selector + "{" + rule.style.cssText + "}\n";
      } else if (rule.cssRules) {
        const child = mirrorRules(rule.cssRules);
        if (child) css += rule.cssText.slice(0, rule.cssText.indexOf("{")) + "{" + child + "}\n";
      } else if (rule.styleSheet) {
        try { css += mirrorRules(rule.styleSheet.cssRules); } catch {}
      }
    }
    return css;
  }
  function refresh() {
    for (const style of mirrors) style.remove();
    mirrors.clear();
    for (const root of shield.styles.roots()) {
      if (root instanceof ShadowRoot && !root.host.isConnected) continue;
      if (!observed.has(root)) {
        observer.observe(root, { childList: true, subtree: true, characterData: true }); observed.add(root);
        if (root instanceof ShadowRoot) shield.listen(root, "focus", () => remember(root.activeElement));
      }
      const content = shield.styles.sheets(root).map(sheet => {
        try { return mirrorRules(sheet.cssRules); } catch { return ""; }
      }).join("\n");
      if (!content || !(document.head || document.documentElement)) continue;
      const style = document.createElement("style");
      mirrors.add(style); style.textContent = content;
      shield.styles.addMirror(style, root);
    }
  }
  const schedule = () => {
    if (timer === null) timer = native.setTimeout(() => { timer = null; refresh(); }, 30);
  };
  const observer = new MutationObserver(records => {
    if (last && !last.isConnected) { last = null; update(); }
    if (records.some(record => {
      const node = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      if (shield.mirrorNodes.has(node)) return false;
      if (node?.tagName === "STYLE") return true;
      return [...record.addedNodes, ...record.removedNodes].some(child => child.nodeType === Node.ELEMENT_NODE &&
        !shield.mirrorNodes.has(child) && (["STYLE", "LINK"].includes(child.tagName) || child.querySelector?.("style,link")));
    })) schedule();
  });
  observer.observe(document, { childList: true, subtree: true, characterData: true }); observed.add(document);
  shield.styles.subscribe(schedule);
  shield.listen(window, "focus", event => {
    if (event.target?.nodeType === Node.ELEMENT_NODE) remember(event.target);
    else if (native.apply(focusGetter, document, [])) remember(document.activeElement);
  });
  shield.listen(window, "blur", event => {
    if (event.target === window || event.target === document) return; // Keep the last genuine focus when system focus is lost.
    if (event.relatedTarget?.nodeType === Node.ELEMENT_NODE) remember(event.relatedTarget);
    else queueMicrotask(() => { if (native.apply(focusGetter, document, [])) remember(document.activeElement); });
  });
  shield.listen(document, "DOMContentLoaded", () => { remember(document.activeElement); refresh(); });
  shield.listen(window, "keydown", () => native.setTimeout(() => {
    if (native.apply(focusGetter, document, [])) remember(document.activeElement);
  }, 0));
  for (const proto of [Document.prototype, Element.prototype, DocumentFragment.prototype]) {
    for (const name of ["querySelector", "querySelectorAll"]) {
      const original = proto[name];
      shield.patch(proto, name, { writable: true, value: function(selector) {
        if (!arguments.length) return native.apply(original, this, []);
        return native.apply(original, this, [rewrite(String(selector))]);
      } });
    }
  }
  for (const name of ["matches", "closest", "webkitMatchesSelector"]) {
    const original = Element.prototype[name];
    if (typeof original !== "function") continue;
    shield.patch(Element.prototype, name, { writable: true, value: function(selector) {
      if (!arguments.length) return native.apply(original, this, []);
      return native.apply(original, this, [rewrite(String(selector))]);
    } });
  }
  shield.features.focusCss = true;
  shield.capabilities.focusCss = true;
}

function installPointerLock(shield) {
  shield.features.pointerLock = true;
  shield.capabilities.pointerLock = typeof Element.prototype.requestPointerLock === "function";
  if (!shield.capabilities.pointerLock) return;
  const { native } = shield;
  let element = null;
  const events = new WeakSet();
  const getter = native.descriptor(Document.prototype, "pointerLockElement").get;
  const nativeRequest = Element.prototype.requestPointerLock, nativeExit = Document.prototype.exitPointerLock;
  const retarget = root => {
    let target = element;
    while (target && target.getRootNode() !== root) {
      const tree = target.getRootNode();
      if (!(tree instanceof ShadowRoot)) return null;
      target = tree.host;
    }
    return target;
  };
  const emit = () => {
    const event = new Event("pointerlockchange", { bubbles: true });
    events.add(event); native.apply(native.dispatch, document, [event]);
  };
  const reset = () => { if (element) { element = null; queueMicrotask(emit); } };
  shield.patch(Document.prototype, "pointerLockElement", { get() {
    const real = native.apply(getter, this, []);
    return this === document && element ? retarget(document) : real;
  } });
  const shadowLock = native.descriptor(ShadowRoot.prototype, "pointerLockElement");
  if (shadowLock?.get) shield.patch(ShadowRoot.prototype, "pointerLockElement", { get() {
    const real = native.apply(shadowLock.get, this, []);
    return element ? retarget(this) : real;
  } });
  shield.patch(Element.prototype, "requestPointerLock", { writable: true, value: function requestPointerLock() {
    if (!(this instanceof Element)) return native.apply(nativeRequest, this, []);
    if (this.ownerDocument !== document || !this.isConnected) return Promise.reject(new DOMException("Disconnected element", "WrongDocumentError"));
    element = this;
    queueMicrotask(emit);
    return Promise.resolve();
  } });
  shield.patch(Document.prototype, "exitPointerLock", { writable: true, value: function exitPointerLock() {
    if (this !== document || !element) return native.apply(nativeExit, this, []);
    reset();
  } });
  for (const type of ["pointerlockchange", "pointerlockerror"]) shield.listen(window, type, event => {
    if (element && !events.has(event)) shield.block(event);
  });
  const observer = new MutationObserver(() => { if (element && !element.isConnected) reset(); });
  observer.observe(document, { childList: true, subtree: true });
  shield.listen(window, "pagehide", reset);
  shield.listen(window, "keydown", event => {
    if (event.key === "Escape" && element) {
      shield.counts.pointerLockEscapes = (shield.counts.pointerLockEscapes || 0) + 1;
      // Virtual state is retained; the real mouse was never captured.
    }
  });
}

function installPresence(shield) {
  "use strict";
  if (!shield || shield.features.presence) return;
  const { native } = shield;
  const docProto = Document.prototype;
  for (const name of ["hidden", "webkitHidden", "mozHidden", "msHidden"]) {
    if (name in document) shield.patch(docProto, name, { get() {
      if (native.hidden) native.apply(native.hidden, this, []); // Preserve native receiver validation.
      return false;
    } });
  }
  for (const name of ["visibilityState", "webkitVisibilityState", "mozVisibilityState", "msVisibilityState"]) {
    if (name in document) shield.patch(docProto, name, { get() {
      if (native.visibility) native.apply(native.visibility, this, []);
      return "visible";
    } });
  }
  shield.patch(docProto, "hasFocus", { writable: true, value: function hasFocus() {
    native.apply(native.focus, this, []);
    return true;
  } });

  const visibilityTypes = ["visibilitychange", "webkitvisibilitychange", "mozvisibilitychange", "msvisibilitychange"];
  for (const type of visibilityTypes) shield.listen(window, type, event => {
    if (event.target === document) shield.block(event);
  });
  for (const type of ["blur", "focus", "focusin", "focusout"]) {
    shield.listen(window, type, event => {
      // Input/element focus events still run. Intercept only browsing-context signals.
      if (event.target === window || event.target === document) shield.block(event);
    });
  }
  shield.features.presence = true;
}

function installFullscreen(shield) {
  "use strict";
  if (!shield || shield.features.fullscreen) return;
  const { native } = shield;
  const marker = shield.attribute();
  const visualMarker = shield.attribute();
  const virtualEvents = new WeakSet();
  const fullscreenTypes = ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"];
  const nativeFullscreen = native.descriptor(Document.prototype, "fullscreenElement")?.get;
  const nativeExit = Document.prototype.exitFullscreen;
  const originalMatchMedia = window.matchMedia;
  const mediaQueries = new Set();
  const cssMirrors = [];
  let element = null;
  let visual = false;
  let ledger = [];
  let styleAttributes = new Map();
  let previousAttribute = null;
  let previousVisualAttribute = null;
  let scroll = null;
  let lastReason = null;
  let observer = null;
  let styleTimer = null;
  let parentExpanded = false;
  let childWindow = null;

  function virtualMedia(query) {
    if (!element) return String(query);
    return String(query).replace(/\(\s*display-mode\s*:\s*([a-z-]+)\s*\)/gi,
      (_, mode) => mode.toLowerCase() === "fullscreen" ? "(width >= 0px)" : "(width < 0px)");
  }

  function notifyMedia(entry) {
    const matches = entry.read();
    if (matches === entry.last) return;
    entry.last = matches;
    const event = new MediaQueryListEvent("change", { media: entry.media, matches });
    native.apply(native.dispatch, entry.mql, [event]);
    if (typeof entry.onchange === "function") entry.onchange.call(entry.mql, event);
  }

  function emitChange() {
    for (const type of fullscreenTypes) {
      if (type !== "fullscreenchange" && !(`on${type.toLowerCase()}` in document)) continue;
      const event = new Event(type, { bubbles: true, composed: true });
      virtualEvents.add(event);
      native.apply(native.dispatch, element?.isConnected ? element : document, [event]);
    }
    for (const reference of mediaQueries) {
      const entry = reference.deref();
      if (!entry) { mediaQueries.delete(reference); continue; }
      notifyMedia(entry);
    }
  }

  for (const type of fullscreenTypes) shield.listen(window, type, event => {
    if (virtualEvents.has(event)) return;
    shield.block(event);
    const real = nativeFullscreen ? native.apply(nativeFullscreen, document, []) : null;
    if (type === "fullscreenchange" && real && nativeExit) {
      native.apply(nativeExit, document, []).then(() => enter(real)).catch(error => {
        shield.failures.push(`native fullscreen fallback: ${error.message}`);
      });
    }
  });

  function setStyle(node, property, value) {
    if (!node?.style) return;
    if (!styleAttributes.has(node)) styleAttributes.set(node, node.hasAttribute("style"));
    if (!ledger.some(item => item.node === node && item.property === property)) {
      ledger.push({ node, property, value: node.style.getPropertyValue(property), priority: node.style.getPropertyPriority(property) });
    }
    node.style.setProperty(property, value, "important");
  }

  function expandParents() {
    if (window.parent === window) return;
    parentExpanded = true;
    window.parent.postMessage({ type: "presence-shield:frame-visual", expanded: true }, "*");
  }

  function contractParents() {
    if (!parentExpanded) return;
    parentExpanded = false;
    window.parent.postMessage({ type: "presence-shield:frame-visual", expanded: false }, "*");
  }

  function show(target) { return shield.mutate(() => showVisual(target)); }

  function showVisual(target) {
    previousVisualAttribute = target.getAttribute(visualMarker);
    target.setAttribute(visualMarker, "");
    scroll = { x: window.scrollX, y: window.scrollY };
    // Keep the element in place so application references and event delegation survive.
    let ancestor = target.parentElement || target.getRootNode()?.host;
    while (ancestor) {
      for (const [property, value] of Object.entries({
        transform: "none", translate: "none", rotate: "none", scale: "none", filter: "none",
        "backdrop-filter": "none", perspective: "none", contain: "none", "content-visibility": "visible",
        "will-change": "auto", overflow: "visible", "clip-path": "none", isolation: "auto"
      })) setStyle(ancestor, property, value);
      const position = getComputedStyle(ancestor).position;
      if (position !== "static") setStyle(ancestor, "z-index", "2147483647");
      ancestor = ancestor.parentElement || ancestor.getRootNode()?.host;
    }
    setStyle(document.documentElement, "overflow", "hidden");
    if (document.body) setStyle(document.body, "overflow", "hidden");
    for (const [property, value] of Object.entries({
      position: "fixed", inset: "0", top: "0", left: "0", right: "0", bottom: "0",
      width: "100vw", height: "100vh", "min-width": "0", "min-height": "0",
      "max-width": "none", "max-height": "none", margin: "0", "box-sizing": "border-box",
      "z-index": "2147483647", transform: "none", translate: "none", rotate: "none", scale: "none"
    })) setStyle(target, property, value);
    visual = true;
    expandParents();
  }

  function collapse(reason = "user") { return shield.mutate(() => collapseVisual(reason)); }

  function collapseVisual(reason) {
    if (!visual) return;
    if (childWindow) {
      childWindow.postMessage({ type: "presence-shield:collapse-child" }, "*");
      childWindow = null;
    }
    for (const item of ledger.reverse()) {
      if (item.value) item.node.style.setProperty(item.property, item.value, item.priority);
      else item.node.style.removeProperty(item.property);
    }
    ledger = [];
    for (const [node, originallyPresent] of styleAttributes) {
      if (!originallyPresent && !node.getAttribute("style")) node.removeAttribute("style");
    }
    styleAttributes.clear();
    if (element) {
      if (previousVisualAttribute === null) element.removeAttribute(visualMarker);
      else element.setAttribute(visualMarker, previousVisualAttribute);
    }
    previousVisualAttribute = null;
    visual = false;
    removeMirrors();
    if (element) refreshMirrors();
    lastReason = reason;
    contractParents();
    if (scroll) window.scrollTo(scroll.x, scroll.y);
    scroll = null;
    // Deliberately keep element, its marker and virtual state. No exit event is emitted.
  }

  function removeMirrors() {
    for (const style of cssMirrors.splice(0)) style.remove();
  }

  // Rewrite pseudo-classes only outside strings/comments. Query APIs and readable CSS
  // can use the virtual marker; this does not alter the browser's actual :fullscreen engine.
  function virtualSelector(selector, forCSS = false) {
    let output = "", quote = "", comment = false;
    for (let i = 0; i < selector.length;) {
      if (comment) {
        if (selector.slice(i, i + 2) === "*/") { output += "*/"; i += 2; comment = false; }
        else output += selector[i++];
      } else if (quote) {
        const char = selector[i++]; output += char;
        if (char === "\\" && i < selector.length) output += selector[i++];
        else if (char === quote) quote = "";
      } else if (selector.slice(i, i + 2) === "/*") { output += "/*"; i += 2; comment = true; }
      else if (selector[i] === "'" || selector[i] === '"') { quote = selector[i]; output += selector[i++]; }
      else if (selector[i] === "\\") { output += selector[i++]; if (i < selector.length) output += selector[i++]; }
      else {
        const match = selector.slice(i).match(/^:(?:fullscreen|webkit-full-screen|moz-full-screen|ms-fullscreen)(?![\w-])/i);
        if (match) { output += `[${marker}]`; i += match[0].length; }
        else output += selector[i++];
      }
    }
    return output;
  }

  function mirrorRules(rules, force = false) {
    let css = "";
    for (const rule of rules) {
      if (rule.selectorText) {
        const selector = virtualSelector(rule.selectorText, true);
        if ((force || selector !== rule.selectorText) && !selector.includes("::backdrop")) {
          // After collapsing the visual element, retain semantic CSS custom properties
          // used to compare virtual fullscreen, without reapplying the fullscreen layout.
          const declaration = visual ? rule.style.cssText : [...rule.style].filter(name => name.startsWith("--")).map(name => `${name}:${rule.style.getPropertyValue(name)}${rule.style.getPropertyPriority(name) ? " !important" : ""};`).join("");
          if (declaration) css += `${selector}{${declaration}}\n`;
        }
      } else if (rule.cssRules) {
        const media = rule.media && /\(\s*display-mode\s*:/i.test(rule.conditionText);
        const child = mirrorRules(rule.cssRules, force || Boolean(media && element));
        const header = media && element ? `@media ${virtualMedia(rule.conditionText)}` : rule.cssText.slice(0, rule.cssText.indexOf("{"));
        if (child) css += `${header}{${child}}\n`;
      } else if (rule.styleSheet) {
        try { css += mirrorRules(rule.styleSheet.cssRules); } catch { /* Cross-origin stylesheet. */ }
      }
    }
    return css;
  }

  function refreshMirrors() {
    removeMirrors();
    if (!element) return;
    const roots = [document];
    const targetRoot = element.getRootNode();
    if (targetRoot !== document && targetRoot instanceof ShadowRoot) roots.push(targetRoot);
    for (const root of roots) {
      for (const sheet of shield.styles.sheets(root)) {
        try {
          const css = mirrorRules(sheet.cssRules);
          if (!css) continue;
          const style = document.createElement("style");
          style.textContent = css;
          shield.styles.addMirror(style, root);
          cssMirrors.push(style);
        } catch { /* Opaque CSS cannot be copied; reported as a known limitation. */ }
      }
    }
  }

  function reset(reason = "reset") {
    const hadState = Boolean(element);
    collapse(reason);
    observer?.disconnect(); observer = null;
    if (styleTimer !== null) { clearTimeout(styleTimer); styleTimer = null; }
    if (element) {
      if (previousAttribute === null) element.removeAttribute(marker);
      else element.setAttribute(marker, previousAttribute);
    }
    element = null;
    previousAttribute = null;
    lastReason = reason;
    removeMirrors();
    if (hadState) emitChange();
  }

  function enter(target) {
    if (!(target instanceof Element) || !target.isConnected || target.ownerDocument !== document) {
      return Promise.reject(new TypeError("Fullscreen cần một phần tử đang nằm trong document hiện tại."));
    }
    if (target === element && visual) return Promise.resolve();
    collapse("switch");
    observer?.disconnect();
    if (element && element !== target) {
      if (previousAttribute === null) element.removeAttribute(marker);
      else element.setAttribute(marker, previousAttribute);
    }
    if (target !== element) previousAttribute = target.getAttribute(marker);
    element = target;
    element.setAttribute(marker, "");
    lastReason = "enter";
    show(target);
    refreshMirrors();
    observer = new MutationObserver(records => {
      if (element && !element.isConnected) { reset("removed"); return; }
      const changedCSS = records.some(record => {
        const parent = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
        if (shield.mirrorNodes.has(parent)) return false;
        if (parent?.matches?.("style")) return true;
        return [...record.addedNodes].some(node => node.nodeType === Node.ELEMENT_NODE &&
          !shield.mirrorNodes.has(node) && (node.matches("style, link[rel=stylesheet]") || node.querySelector("style, link[rel=stylesheet]")));
      });
      if (changedCSS && styleTimer === null) styleTimer = native.setTimeout(() => {
        styleTimer = null; refreshMirrors();
      }, 30);
    });
    observer.observe(document, { childList: true, subtree: true, characterData: true });
    if (target.getRootNode() instanceof ShadowRoot) observer.observe(target.getRootNode(), { childList: true, subtree: true, characterData: true });
    // Preserve the asynchronous event ordering expected by applications.
    native.setTimeout(() => { if (element === target) emitChange(); }, 0);
    return Promise.resolve();
  }

  for (const name of ["fullscreenElement", "webkitFullscreenElement", "mozFullScreenElement", "msFullscreenElement"]) {
    if (name in document || name === "fullscreenElement") {
      const original = native.descriptor(Document.prototype, name)?.get;
      shield.patch(Document.prototype, name, { get() {
        const real = original ? native.apply(original, this, []) : null;
        return this === document && element ? retarget(element, document) : real;
      } });
    }
  }
  function retarget(target, root) {
    while (target && target.getRootNode() !== root) {
      const tree = target.getRootNode();
      if (!(tree instanceof ShadowRoot)) return null;
      target = tree.host;
    }
    return target;
  }
  const shadowFullscreen = native.descriptor(ShadowRoot.prototype, "fullscreenElement");
  if (shadowFullscreen?.get) shield.patch(ShadowRoot.prototype, "fullscreenElement", { get() {
    const real = native.apply(shadowFullscreen.get, this, []);
    return element ? retarget(element, this) : real;
  } });
  for (const name of ["fullscreen", "webkitIsFullScreen", "mozFullScreen"]) {
    if (name in document) {
      const original = native.descriptor(Document.prototype, name)?.get;
      shield.patch(Document.prototype, name, { get() {
        const real = original ? native.apply(original, this, []) : false;
        return this === document && element ? true : real;
      } });
    }
  }
  for (const name of ["requestFullscreen", "webkitRequestFullscreen", "webkitRequestFullScreen", "mozRequestFullScreen", "msRequestFullscreen"]) {
    if (name in Element.prototype) shield.patch(Element.prototype, name, {
      writable: true, value: function requestFullscreen() { return enter(this); }
    });
  }
  for (const name of ["exitFullscreen", "webkitExitFullscreen", "webkitCancelFullScreen", "mozCancelFullScreen", "msExitFullscreen"]) {
    if (name in document) shield.patch(Document.prototype, name, {
      writable: true, value: function exitFullscreen() {
        if (this !== document) return Promise.reject(new TypeError("Illegal invocation"));
        if (element) { reset("site-exit"); return Promise.resolve(); }
        return nativeExit ? native.apply(nativeExit, this, []) : Promise.resolve();
      }
    });
  }

  const queryTargets = [Document.prototype, Element.prototype, DocumentFragment.prototype];
  for (const proto of queryTargets) {
    for (const name of ["querySelector", "querySelectorAll"]) {
      const original = proto[name];
      if (typeof original === "function") shield.patch(proto, name, { writable: true, value: function(selector) {
        if (!arguments.length) return native.apply(original, this, []);
        return native.apply(original, this, [element ? virtualSelector(String(selector)) : selector]);
      } });
    }
  }
  for (const name of ["matches", "closest", "webkitMatchesSelector"]) {
    const original = Element.prototype[name];
    if (typeof original === "function") shield.patch(Element.prototype, name, { writable: true, value: function(selector) {
      if (!arguments.length) return native.apply(original, this, []);
      return native.apply(original, this, [element ? virtualSelector(String(selector)) : selector]);
    } });
  }

  shield.patch(window, "matchMedia", { writable: true, value: function matchMedia(query) {
    if (!arguments.length) return native.apply(originalMatchMedia, window, []);
    const mql = native.apply(originalMatchMedia, window, [query]);
    if (!/\(\s*display-mode\s*:/i.test(String(query))) return mql;
    const originalGet = native.descriptor(MediaQueryList.prototype, "matches").get;
    let reference;
    const entry = { mql, media: mql.media, onchange: null, last: null, evalQuery: null, evalMql: null, unlisten: null, read: () => {
      if (!element) {
        entry.unlisten?.(); entry.unlisten = null; entry.evalQuery = null; entry.evalMql = null;
        return native.apply(originalGet, mql, []);
      }
      const rewritten = virtualMedia(query);
      if (rewritten !== entry.evalQuery) {
        entry.unlisten?.();
        entry.evalQuery = rewritten;
        entry.evalMql = native.apply(originalMatchMedia, window, [rewritten]);
        entry.unlisten = shield.listen(entry.evalMql, "change", () => {
          const live = reference?.deref(); if (live) notifyMedia(live);
        });
      }
      return native.apply(originalGet, entry.evalMql, []);
    } };
    reference = new WeakRef(entry);
    entry.last = entry.read();
    shield.patch(mql, "matches", { get: entry.read });
    shield.patch(mql, "onchange", { get: () => entry.onchange, set: value => { entry.onchange = value; } });
    shield.patch(mql, "addListener", { writable: true, value(listener) {
      native.apply(native.add, mql, ["change", listener]);
    } });
    shield.patch(mql, "removeListener", { writable: true, value(listener) {
      native.apply(native.remove, mql, ["change", listener]);
    } });
    // Native display-mode changes must not expose an inconsistent virtual result.
    shield.listen(mql, "change", event => { if (element && event.isTrusted) shield.block(event); });
    mediaQueries.add(reference);
    return mql;
  } });

  shield.styles.subscribe(() => {
    if (element && styleTimer === null) styleTimer = native.setTimeout(() => { styleTimer = null; refreshMirrors(); }, 30);
  });

  shield.listen(window, "keydown", event => {
    if (event.key === "Escape" && element && visual) {
      event.preventDefault(); shield.block(event); collapse("escape");
    }
  });

  shield.listen(window, "message", event => {
    if (event.data?.type === "presence-shield:collapse-child" && event.source === window.parent && parentExpanded) {
      collapse("parent"); return;
    }
    if (event.data?.type !== "presence-shield:frame-visual" || typeof event.data.expanded !== "boolean") return;
    // A message can only resize the direct child frame that actually sent it.
    const frame = [...document.querySelectorAll("iframe, frame")].find(node => node.contentWindow === event.source);
    if (!frame) return;
    if (event.data.expanded) {
      enter(frame).catch(error => shield.failures.push(error.message)); childWindow = event.source;
    } else if (element === frame) {
      childWindow = null; collapse("child");
    }
  });

  shield.fullscreen = {
    collapse,
    reset,
    status: () => ({ virtual: Boolean(element), visual, tag: element?.tagName || null, reason: lastReason })
  };
  shield.features.fullscreen = true;
}

function installLifecycle(shield) {
  "use strict";
  if (!shield || shield.features.lifecycle) return;
  for (const type of ["freeze", "resume"]) shield.listen(window, type, event => {
    if (event.target === document) shield.block(event);
  });
  const descriptor = shield.native.descriptor(Document.prototype, "wasDiscarded");
  if (descriptor?.get) shield.patch(Document.prototype, "wasDiscarded", { get() {
    shield.native.apply(descriptor.get, this, []); return false;
  } });
  // Do not suppress pagehide/pageshow/beforeunload: they also protect unsaved data and BFCache.
  shield.features.lifecycle = true;
}

function installPointer(shield) {
  "use strict";
  if (!shield || shield.features.pointer) return;
  for (const type of ["mouseout", "mouseleave", "pointerout", "pointerleave"]) {
    shield.listen(window, type, event => {
      if (event.relatedTarget == null) shield.block(event);
    });
  }
  for (const type of ["mouseover", "mouseenter", "pointerover", "pointerenter"]) shield.listen(window, type, event => {
    if (event.relatedTarget == null && [window, document, document.documentElement, document.body].includes(event.target)) shield.block(event);
  });
  shield.features.pointer = true;
}

function installPassiveEvents(shield) {
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

function installTabIsolation(shield) {
  const { native } = shield, NativeChannel = window.BroadcastChannel;
  shield.features.tabIsolation = true;
  shield.capabilities.tabIsolation = typeof NativeChannel === "function";
  if (!shield.capabilities.tabIsolation) return;
  const names = new WeakMap(), suffix = ":" + shield.attribute();
  const nameGetter = native.descriptor(NativeChannel.prototype, "name").get;
  const Channel = new native.Proxy(NativeChannel, {
    construct(target, args, newTarget) {
      if (!args.length) return native.construct(target, args, newTarget);
      // WebIDL DOMString rejects Symbol, whereas String(Symbol) would silently accept it.
      if (typeof args[0] === "symbol") return native.construct(target, args, newTarget);
      const name = String(args[0]);
      const channel = native.construct(target, [name + suffix], newTarget);
      names.set(channel, name);
      return channel;
    }
  });
  shield.patch(NativeChannel.prototype, "name", { get() {
    const actual = native.apply(nameGetter, this, []); return names.get(this) ?? actual;
  } });
  shield.patch(window, "BroadcastChannel", { value: Channel });
}

function installGeometry(shield) {
  const { native } = shield;
  const freeze = (object, name, owner = object) => {
    let descriptor;
    for (let target = object; target && !descriptor; target = Object.getPrototypeOf(target)) descriptor = native.descriptor(target, name);
    if (!descriptor?.get) return;
    const initial = native.apply(descriptor.get, object, []);
    shield.patch(owner, name, { get() {
      const current = native.apply(descriptor.get, this, []);
      return this === object ? initial : current;
    } });
  };
  for (const name of ["innerWidth", "innerHeight", "outerWidth", "outerHeight", "screenX", "screenY", "screenLeft", "screenTop", "devicePixelRatio"]) freeze(window, name);
  for (const name of ["width", "height", "availWidth", "availHeight", "availLeft", "availTop", "colorDepth", "pixelDepth"]) freeze(screen, name, Screen.prototype);
  if (window.visualViewport) for (const name of ["width", "height", "scale", "offsetLeft", "offsetTop", "pageLeft", "pageTop"]) freeze(window.visualViewport, name, VisualViewport.prototype);
  if (screen.orientation) for (const name of ["type", "angle"]) freeze(screen.orientation, name, ScreenOrientation.prototype);
  shield.listen(window, "resize", event => { if (event.target === window) shield.block(event); });
  if (window.visualViewport) for (const type of ["resize", "scroll"]) shield.listen(window.visualViewport, type, event => shield.block(event));
  if (screen.orientation) shield.listen(screen.orientation, "change", event => shield.block(event));
  shield.features.geometry = true;
  shield.capabilities.geometry = true;
}

function installDomPrivacy(shield) {
  const { native } = shield, NativeObserver = window.MutationObserver;
  const takeRecords = NativeObserver.prototype.takeRecords, disconnect = NativeObserver.prototype.disconnect;
  const states = new WeakMap(), references = new Set();
  let depth = 0;
  const owned = node => {
    for (let current = node; current; current = current.parentNode) if (shield.mirrorNodes.has(current)) return true;
    return false;
  };
  const filter = records => records.filter(record => {
    const hidden = owned(record.target) || record.type === "attributes" && shield.privateAttributes.has(record.attributeName)
      || record.type === "childList" && record.addedNodes.length + record.removedNodes.length > 0 && [...record.addedNodes, ...record.removedNodes].every(owned);
    if (hidden) shield.counts.privateMutations = (shield.counts.privateMutations || 0) + 1;
    return !hidden;
  });
  const Observer = new native.Proxy(NativeObserver, {
    construct(target, args, newTarget) {
      if (typeof args[0] !== "function") return native.construct(target, args, newTarget);
      const callback = args[0];
      const state = { callback, pending: [], queued: false };
      const observer = native.construct(target, [function(records, instance) {
        const visible = [...state.pending.splice(0), ...filter(records)];
        if (visible.length) native.apply(callback, this, [visible, instance]);
      }], newTarget);
      states.set(observer, state); references.add(new WeakRef(observer));
      return observer;
    }
  });
  shield.patch(NativeObserver.prototype, "takeRecords", { value: function() {
    const records = filter(native.apply(takeRecords, this, []));
    return [...(states.get(this)?.pending.splice(0) || []), ...records];
  } });
  shield.patch(NativeObserver.prototype, "disconnect", { value: function() {
    const result = native.apply(disconnect, this, []);
    if (states.has(this)) states.get(this).pending.length = 0;
    return result;
  } });
  shield.patch(window, "MutationObserver", { value: Observer });
  // Drain page records before an explicitly owned synchronous DOM operation, then
  // discard only the records created by that operation. Earlier/later page writes,
  // native MutationRecord instances and oldValue semantics remain intact.
  shield.mutate = callback => {
    if (depth) return callback();
    depth++;
    const observers = [];
    for (const reference of references) {
      const observer = reference.deref();
      if (!observer) { references.delete(reference); continue; }
      const state = states.get(observer);
      state.pending.push(...filter(native.apply(takeRecords, observer, [])));
      observers.push({ observer, state });
    }
    try { return callback(); }
    finally {
      for (const { observer, state } of observers) {
        const privateRecords = native.apply(takeRecords, observer, []);
        shield.counts.privateMutations = (shield.counts.privateMutations || 0) + privateRecords.length;
        if (state.pending.length && !state.queued) {
          state.queued = true;
          queueMicrotask(() => {
            state.queued = false;
            if (state.pending.length) native.apply(state.callback, observer, [state.pending.splice(0), observer]);
          });
        }
      }
      depth--;
    }
  };
  shield.features.domPrivacy = true;
  shield.capabilities.domPrivacy = true;
}

const shield = createRuntime(); shield.version = VERSION;
shield.signature = ["presence","fullscreen","lifecycle","pointer","performance","wakeLock","idle","focusCss","pointerLock","screenInfo","capture","passiveEvents","tabIsolation","geometry","domPrivacy"].map(key => config[key] ? "1" : "0").join("");
if (config.fullscreen || config.focusCss) installStyleTools(shield);
if (config.domPrivacy) installDomPrivacy(shield);
if (config.performance) installPerformance(shield);
if (config.wakeLock) installWakeLock(shield);
if (config.idle) installIdle(shield);
installPrivacy(shield, config);
if (config.focusCss) installFocusCss(shield);
if (config.pointerLock) installPointerLock(shield);
if (config.presence) installPresence(shield);
if (config.fullscreen) installFullscreen(shield);
if (config.lifecycle) installLifecycle(shield);
if (config.pointer) installPointer(shield);
if (config.passiveEvents) installPassiveEvents(shield);
if (config.tabIsolation) installTabIsolation(shield);
if (config.geometry) installGeometry(shield);
shield.listen(window, CONTROL_EVENT, event => {
  if (event.target !== window || !event.detail || typeof event.detail !== "object") return;
  event.stopImmediatePropagation();
  if (event.detail.action === "collapse") shield.fullscreen?.collapse();
  if (event.detail.action === "reset") shield.fullscreen?.reset();
  event.detail.result = shield.report();
});
})();
