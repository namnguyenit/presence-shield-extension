export const FEATURE_KEYS = Object.freeze(["presence", "fullscreen", "lifecycle", "pointer", "performance", "wakeLock", "idle", "focusCss", "pointerLock", "screenInfo", "capture", "passiveEvents", "tabIsolation", "geometry", "domPrivacy"]);
export const DEFAULTS = Object.freeze({
  enabled: true,
  presence: true,
  fullscreen: true,
  lifecycle: false,
  pointer: false,
  preventDiscard: true,
  performance: true,
  wakeLock: true,
  idle: true,
  focusCss: true,
  pointerLock: true,
  screenInfo: true,
  capture: false,
  passiveEvents: false,
  tabIsolation: false,
  geometry: false,
  domPrivacy: false,
  network: false,
  trackerUrls: [],
  excludedHosts: []
});

export function normalizeSettings(input = {}) {
  const result = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (typeof DEFAULTS[key] === "boolean" && typeof input[key] === "boolean") result[key] = input[key];
  }
  result.excludedHosts = [...new Set((Array.isArray(input.excludedHosts) ? input.excludedHosts : [])
    .filter(host => typeof host === "string" && /^(?:[a-z0-9-]+\.)*[a-z0-9-]+$/i.test(host))
    .map(host => host.toLowerCase()))].slice(0, 500);
  result.trackerUrls = [...new Set((Array.isArray(input.trackerUrls) ? input.trackerUrls : []).map(value => {
    if (typeof value !== "string" || value.length > 1000 || /[\s\r\n]/.test(value)) return null;
    const plain = value.endsWith("*") ? value.slice(0, -1) : value;
    if (plain.includes("*")) return null;
    try {
      const url = new URL(plain);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) return null;
      return url.href + (value.endsWith("*") ? "*" : "");
    } catch { return null; }
  }).filter(Boolean))].slice(0, 50);
  return result;
}

export function featureSignature(settings) { return FEATURE_KEYS.map(key => settings[key] ? "1" : "0").join(""); }

export function registrations(settings) {
  if (!settings.enabled) return [];
  if (!FEATURE_KEYS.some(key => settings[key])) return [];
  return [{
    id: "ps-protection",
    matches: ["http://*/*", "https://*/*"],
    excludeMatches: settings.excludedHosts.flatMap(host => [`http://${host}/*`, `https://${host}/*`]),
    js: ["build/setup.js", ...FEATURE_KEYS.map(key => `build/config-${key}-${settings[key] ? "on" : "off"}.js`), "build/protection.js"],
    runAt: "document_start",
    world: "MAIN",
    allFrames: true,
    matchOriginAsFallback: true,
    persistAcrossSessions: true
  }];
}
