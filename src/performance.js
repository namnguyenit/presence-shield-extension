export function installPerformance(shield) {
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
