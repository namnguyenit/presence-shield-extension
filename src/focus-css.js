export function installFocusCss(shield) {
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
