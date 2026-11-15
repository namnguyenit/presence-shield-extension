export function installPrivacy(shield, config) {
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
