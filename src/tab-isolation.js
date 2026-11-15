export function installTabIsolation(shield) {
  const { native } = shield, NativeChannel = window.BroadcastChannel;
  shield.features.tabIsolation = true;
  shield.capabilities.tabIsolation = typeof NativeChannel === "function";
  if (!shield.capabilities.tabIsolation) return;
  const names = new WeakMap(), suffix = ":" + shield.attribute();
  const nameGetter = native.descriptor(NativeChannel.prototype, "name").get;
  const Channel = new native.Proxy(NativeChannel, {
    construct(target, args, newTarget) {
      if (!args.length) return native.construct(target, args, newTarget);
      // WebIDL DOMString rejects Symbol, whereas String(Symbol) would silently accept it.
      if (typeof args[0] === "symbol") return native.construct(target, args, newTarget);
      const name = String(args[0]);
      const channel = native.construct(target, [name + suffix], newTarget);
      names.set(channel, name);
      return channel;
    }
  });
  shield.patch(NativeChannel.prototype, "name", { get() {
    const actual = native.apply(nameGetter, this, []); return names.get(this) ?? actual;
  } });
  shield.patch(window, "BroadcastChannel", { value: Channel });
}
