export function installWakeLock(shield) {
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
