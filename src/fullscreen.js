export function installFullscreen(shield) {
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
