export function installIdle(shield) {
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

