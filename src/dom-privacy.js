export function installDomPrivacy(shield) {
  const { native } = shield, NativeObserver = window.MutationObserver;
  const takeRecords = NativeObserver.prototype.takeRecords, disconnect = NativeObserver.prototype.disconnect;
  const states = new WeakMap(), references = new Set();
  let depth = 0;
  const owned = node => {
    for (let current = node; current; current = current.parentNode) if (shield.mirrorNodes.has(current)) return true;
    return false;
  };
  const filter = records => records.filter(record => {
    const hidden = owned(record.target) || record.type === "attributes" && shield.privateAttributes.has(record.attributeName)
      || record.type === "childList" && record.addedNodes.length + record.removedNodes.length > 0 && [...record.addedNodes, ...record.removedNodes].every(owned);
    if (hidden) shield.counts.privateMutations = (shield.counts.privateMutations || 0) + 1;
    return !hidden;
  });
  const Observer = new native.Proxy(NativeObserver, {
    construct(target, args, newTarget) {
      if (typeof args[0] !== "function") return native.construct(target, args, newTarget);
      const callback = args[0];
      const state = { callback, pending: [], queued: false };
      const observer = native.construct(target, [function(records, instance) {
        const visible = [...state.pending.splice(0), ...filter(records)];
        if (visible.length) native.apply(callback, this, [visible, instance]);
      }], newTarget);
      states.set(observer, state); references.add(new WeakRef(observer));
      return observer;
    }
  });
  shield.patch(NativeObserver.prototype, "takeRecords", { value: function() {
    const records = filter(native.apply(takeRecords, this, []));
    return [...(states.get(this)?.pending.splice(0) || []), ...records];
  } });
  shield.patch(NativeObserver.prototype, "disconnect", { value: function() {
    const result = native.apply(disconnect, this, []);
    if (states.has(this)) states.get(this).pending.length = 0;
    return result;
  } });
  shield.patch(window, "MutationObserver", { value: Observer });
  // Drain page records before an explicitly owned synchronous DOM operation, then
  // discard only the records created by that operation. Earlier/later page writes,
  // native MutationRecord instances and oldValue semantics remain intact.
  shield.mutate = callback => {
    if (depth) return callback();
    depth++;
    const observers = [];
    for (const reference of references) {
      const observer = reference.deref();
      if (!observer) { references.delete(reference); continue; }
      const state = states.get(observer);
      state.pending.push(...filter(native.apply(takeRecords, observer, [])));
      observers.push({ observer, state });
    }
    try { return callback(); }
    finally {
      for (const { observer, state } of observers) {
        const privateRecords = native.apply(takeRecords, observer, []);
        shield.counts.privateMutations = (shield.counts.privateMutations || 0) + privateRecords.length;
        if (state.pending.length && !state.queued) {
          state.queued = true;
          queueMicrotask(() => {
            state.queued = false;
            if (state.pending.length) native.apply(state.callback, observer, [state.pending.splice(0), observer]);
          });
        }
      }
      depth--;
    }
  };
  shield.features.domPrivacy = true;
  shield.capabilities.domPrivacy = true;
}
