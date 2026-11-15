export function installPresence(shield) {
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
