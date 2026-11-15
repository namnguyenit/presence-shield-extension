export function rewritePseudos(selector, replace) {
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

export function installStyleTools(shield) {
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
