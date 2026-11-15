export function installPointerLock(shield) {
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
