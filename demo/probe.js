// Intentionally registered early, before the rest of this test page initializes.
window.probeEvents = [];
const record = (where, event) => {
  window.probeEvents.push({ where, type: event.type, target: event.target === window ? "window" : event.target === document ? "document" : event.target.id || event.target.tagName,
    trusted: event.isTrusted, hidden: document.hidden, focused: document.hasFocus(), time: new Date().toLocaleTimeString() });
  if (window.probeEvents.length > 150) window.probeEvents.shift();
};
for (const type of ["visibilitychange", "focus", "blur", "focusin", "focusout", "freeze", "resume", "fullscreenchange", "mouseleave", "pointerleave"]) {
  window.addEventListener(type, event => record("window/capture", event), true);
  document.addEventListener(type, event => record("document/bubble", event));
}
window.onblur = event => record("window.onblur", event);
window.onfocus = event => record("window.onfocus", event);
document.onvisibilitychange = event => record("document.onvisibilitychange", event);
window.probeVisibilityEntries = [];
if (PerformanceObserver.supportedEntryTypes.includes("visibility-state")) {
  const observer = new PerformanceObserver(list => {
    window.probeVisibilityEntries.push(...list.getEntries().map(entry => entry.toJSON()));
    window.probeVisibilityEntries = window.probeVisibilityEntries.slice(-30);
  });
  observer.observe({ type: "visibility-state", buffered: true });
}
