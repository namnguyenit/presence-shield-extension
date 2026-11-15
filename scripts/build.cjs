const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const modules = ["runtime", "selectors", "performance", "wake-lock", "idle", "privacy", "focus-css", "pointer-lock", "presence", "fullscreen", "lifecycle", "pointer", "passive-events", "tab-isolation", "geometry", "dom-privacy"];
const source = modules.map(name => fs.readFileSync(path.join(root, "src", name + ".js"), "utf8").replace(/^export /gm, "")).join("\n");
const features = JSON.parse(fs.readFileSync(path.join(root, "src", "settings.js"), "utf8").match(/FEATURE_KEYS = Object.freeze\((\[[^\n]+\])\)/)[1]);
const protocol = fs.readFileSync(path.join(root, "src", "protocol.js"), "utf8").replace(/^export /gm, "");
const configKey = "__ps_setup_2_dcb154203be74b418b7c0a29";
const out = path.join(root, "build");
fs.mkdirSync(out, { recursive: true });
// Only remove generated old bundles inside this known workspace build directory.
for (const file of fs.readdirSync(out)) if (/^protection-\d+\.js$/.test(file)) fs.unlinkSync(path.join(out, file));
fs.writeFileSync(path.join(out, "setup.js"), "Object.defineProperty(globalThis, Symbol.for(" + JSON.stringify(configKey) + "), { value: Object.create(null), configurable: true });\n");
for (const feature of features) for (const enabled of [true, false]) {
  fs.writeFileSync(path.join(out, "config-" + feature + "-" + (enabled ? "on" : "off") + ".js"),
    "globalThis[Symbol.for(" + JSON.stringify(configKey) + ")][" + JSON.stringify(feature) + "] = " + enabled + ";\n");
}
const calls = [
  "if (config.fullscreen || config.focusCss) installStyleTools(shield);",
  "if (config.domPrivacy) installDomPrivacy(shield);",
  "if (config.performance) installPerformance(shield);",
  "if (config.wakeLock) installWakeLock(shield);",
  "if (config.idle) installIdle(shield);",
  "installPrivacy(shield, config);",
  "if (config.focusCss) installFocusCss(shield);",
  "if (config.pointerLock) installPointerLock(shield);",
  "if (config.presence) installPresence(shield);",
  "if (config.fullscreen) installFullscreen(shield);",
  "if (config.lifecycle) installLifecycle(shield);",
  "if (config.pointer) installPointer(shield);",
  "if (config.passiveEvents) installPassiveEvents(shield);",
  "if (config.tabIsolation) installTabIsolation(shield);",
  "if (config.geometry) installGeometry(shield);"
].join("\n");
const bundle = [
  "// Generated. Edit src/, then run npm run build.",
  "(() => {", '"use strict";', protocol,
  "const configKey = Symbol.for(" + JSON.stringify(configKey) + ");",
  "const config = globalThis[configKey] || {}; delete globalThis[configKey];",
  'const probe = { action: "status", result: null };',
  "window.dispatchEvent(new CustomEvent(CONTROL_EVENT, { detail: probe }));",
  "if (probe.result?.version === VERSION) return;",
  source,
  "const shield = createRuntime(); shield.version = VERSION;",
  "shield.signature = " + JSON.stringify(features) + '.map(key => config[key] ? "1" : "0").join("");',
  calls,
  "shield.listen(window, CONTROL_EVENT, event => {",
  '  if (event.target !== window || !event.detail || typeof event.detail !== "object") return;',
  "  event.stopImmediatePropagation();",
  '  if (event.detail.action === "collapse") shield.fullscreen?.collapse();',
  '  if (event.detail.action === "reset") shield.fullscreen?.reset();',
  "  event.detail.result = shield.report();",
  "});", "})();", ""
].join("\n");
fs.writeFileSync(path.join(out, "protection.js"), bundle);
console.log("Built private runtime and composable configuration scripts.");
