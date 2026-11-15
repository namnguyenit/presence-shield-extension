export function installLifecycle(shield) {
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
