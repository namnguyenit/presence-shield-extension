const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const packages = "C:/Users/LEGION/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules";
let playwright;
try { playwright = require("playwright"); } catch { playwright = require(require.resolve("playwright", { paths: [packages] })); }
const root = path.resolve(__dirname, "..");
let context, server, worker, extensionId, base, otherBase;
const errors = [];
const observations = {};
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "presence-shield-tests-"));
let KEY;

async function start() {
  if (context) return;
  fs.mkdirSync(path.join(root, "test-results"), { recursive: true });
  server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === "/favicon.ico") { response.writeHead(204); response.end(); return; }
    if (url.pathname === "/csp") {
      response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'");
      response.end('<!doctype html><title>CSP test</title><link rel="stylesheet" href="/demo/demo.css"><script src="/demo/probe.js"></script><div id="stage">CSP stage</div>');
      return;
    }
    if (url.pathname === "/blank") { response.end("<!doctype html><title>Other tab</title><p>Other tab</p>"); return; }
    const file = path.join(root, url.pathname.endsWith("/") ? `${url.pathname}index.html` : url.pathname);
    if (!fs.existsSync(file)) { response.writeHead(404); response.end(); return; }
    const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(file)] || "text/plain";
    response.setHeader("Content-Type", `${mime}; charset=utf-8`); response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, "0.0.0.0", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  otherBase = `http://localhost:${server.address().port}`;
  context = await playwright.chromium.launchPersistentContext(profile, {
    channel: "chromium", headless: true, viewport: { width: 1100, height: 800 },
    args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
  KEY = (await import("../src/protocol.js")).CONTROL_EVENT;
  await context.addInitScript(eventName => { window.__testProtection = () => { const detail = { action: "status", result: null }; window.dispatchEvent(new CustomEvent(eventName, { detail })); return detail.result; }; }, KEY);
  context.on("page", page => page.on("pageerror", error => errors.push(error.message)));
  worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  extensionId = worker.url().split("/")[2];
  await worker.evaluate(async () => {
    for (let i = 0; i < 100; i++) {
      if ((await chrome.scripting.getRegisteredContentScripts()).length >= 1) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error("Content scripts not registered");
  });
}

async function page() { await start(); const p = await context.newPage(); await p.goto(`${base}/demo/`); return p; }
async function report(p) { return p.evaluate(key => window.__testProtection(), KEY); }
async function realReadings(p) {
  const owner = typeof p.page === "function" ? p.page() : p;
  return worker.evaluate(async ({ topURL, frameURL }) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(tab => tab.url === topURL);
    const frames = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, world: "ISOLATED",
      func: () => ({ href: location.href, hidden: document.hidden, focus: document.hasFocus(), fullscreen: Boolean(document.fullscreenElement) }) });
    return frames.find(frame => frame.result.href === frameURL)?.result;
  }, { topURL: owner.url(), frameURL: p.url() });
}
async function command(type, extra = {}) {
  const popup = await context.newPage(); await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  const result = await popup.evaluate(async ({ type, extra }) => chrome.runtime.sendMessage({ type, ...extra }), { type, extra });
  await popup.close(); assert.equal(result.ok, true, result.error); return result;
}

test("real unpacked extension registers MAIN scripts and injects before early site listeners", async () => {
  const p = await page();
  const r = await report(p);
  assert.equal(r.features.presence, true); assert.equal(r.features.fullscreen, true); assert.deepEqual(r.failures, []);
  assert.equal(r.exposed.visibility, "visible"); assert.equal(r.exposed.focus, true);
  assert.equal(await p.evaluate(key => globalThis[Symbol.for("PresenceShield.runtime.v1")] === undefined && window.__testProtection().native === undefined, KEY), true);
  const settings = await command("GET_SETTINGS"); assert.equal(settings.settings.enabled, true);
  await p.close();
});

test("native background focus is masked and synthetic state notifications are blocked", async () => {
  const p = await page();
  const other = await context.newPage(); await other.goto(`${base}/blank`); await other.bringToFront();
  const r = await report(p);
  assert.equal(r.exposed.hidden, false); assert.equal(r.exposed.focus, true);
  observations.background = { native: await realReadings(p), exposed: r.exposed };
  // Headless does not reproduce every desktop visibility transition. Explicitly test dispatch paths too.
  const result = await p.evaluate(() => {
    window.probeEvents.length = 0;
    document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("blur")); window.dispatchEvent(new Event("focus"));
    return window.probeEvents;
  });
  assert.deepEqual(result, []);
  await other.close(); await p.close();
});

test("input blur/focus and receiver validation survive", async () => {
  const p = await page(); await p.locator("#input").focus(); await p.locator("#input2").focus();
  const result = await p.evaluate(() => ({ events: window.probeEvents.map(item => [item.type, item.target]),
    invalid: (() => { try { Document.prototype.hasFocus.call({}); return false; } catch { return true; } })() }));
  assert.ok(result.events.some(([type, target]) => type === "blur" && target === "input"));
  assert.ok(result.events.some(([type, target]) => type === "focus" && target === "input2"));
  assert.equal(result.invalid, true); await p.close();
});

test("virtual fullscreen never enters native mode; Escape restores styles but preserves virtual state", async () => {
  const p = await page();
  const before = await p.locator("#stage").evaluate(node => ({ style: node.getAttribute("style"), rect: node.getBoundingClientRect().toJSON(), bg: getComputedStyle(node).backgroundColor }));
  await p.locator("#enter").click();
  const r = await report(p); assert.equal((await realReadings(p)).fullscreen, false); assert.equal(r.fullscreen.virtual, true); assert.equal(r.fullscreen.visual, true);
  const api = await p.evaluate(() => ({ selector: document.querySelector(":fullscreen")?.id,
    matches: document.getElementById("stage").matches(":fullscreen"), media: matchMedia("(display-mode: fullscreen)").matches,
    browser: matchMedia("(display-mode: browser)").matches, bg: getComputedStyle(document.getElementById("stage")).backgroundColor,
    rect: document.getElementById("stage").getBoundingClientRect().toJSON(), width: innerWidth, height: innerHeight }));
  assert.equal(api.selector, "stage"); assert.equal(api.matches, true); assert.equal(api.media, true); assert.equal(api.browser, false);
  assert.equal(api.bg, "rgb(23, 61, 51)"); assert.equal(api.rect.width, api.width); assert.equal(api.rect.height, api.height);
  await p.keyboard.press("Escape");
  const collapsed = await report(p); assert.equal(collapsed.fullscreen.visual, false); assert.equal(collapsed.fullscreen.virtual, true);
  const restored = await p.locator("#stage").evaluate(node => ({ style: node.getAttribute("style"), rect: node.getBoundingClientRect().toJSON(), bg: getComputedStyle(node).backgroundColor }));
  assert.equal(restored.style, before.style); assert.equal(restored.rect.width, before.rect.width); assert.equal(restored.rect.height, before.rect.height); assert.equal(restored.bg, before.bg);
  await p.evaluate(() => document.exitFullscreen());
  assert.equal((await report(p)).fullscreen.virtual, false);
  assert.equal(await p.locator("#stage").evaluate(node => node.hasAttribute("data-presence-shield-fullscreen")), false);
  await p.close();
});

test("fullscreen switch, removal and style property priorities restore correctly", async () => {
  const p = await page();
  await p.evaluate(async () => {
    const stage = document.getElementById("stage"); stage.style.setProperty("position", "relative", "important");
    stage.style.setProperty("margin", "13px"); await stage.requestFullscreen();
    await document.getElementById("input2").requestFullscreen();
  });
  const restored = await p.locator("#stage").evaluate(node => [node.style.position, node.style.getPropertyPriority("position"), node.style.margin]);
  assert.deepEqual(restored, ["relative", "important", "13px"]);
  await p.locator("#input2").evaluate(node => node.remove());
  await p.waitForFunction(() => document.fullscreenElement === null);
  await p.close();
});

test("dynamic same-origin, cross-origin and about:blank frames are injected", async () => {
  const p = await page();
  await p.evaluate(other => {
    for (const src of ["frame.html", `${other}/demo/frame.html`, "about:blank"]) { const iframe = document.createElement("iframe"); iframe.src = src; document.body.appendChild(iframe); }
  }, otherBase);
  await p.waitForFunction(() => document.querySelectorAll("iframe").length === 3);
  for (const f of p.frames().slice(1)) {
    await f.waitForFunction(key => Boolean(window.__testProtection().features.presence), KEY);
    const r = await report(f); assert.equal(r.exposed.focus, true); assert.equal(r.exposed.visibility, "visible");
  }
  await p.close();
});

test("cross-origin iframe fullscreen expands its container and collapses coherently", async () => {
  const p = await page();
  const navigation = p.waitForEvent("framenavigated", { predicate: f => f.url().includes("localhost") });
  await p.evaluate(other => { const iframe = document.createElement("iframe"); iframe.src = `${other}/demo/frame.html`; iframe.id = "cross"; document.body.appendChild(iframe); }, otherBase);
  const f = await navigation;
  await f.waitForSelector("#frame-stage"); await f.locator("#frame-fullscreen").click();
  await p.waitForFunction(() => document.fullscreenElement?.id === "cross");
  assert.equal((await report(p)).fullscreen.visual, true); assert.equal((await realReadings(f)).fullscreen, false);
  await f.locator("body").press("Escape");
  await p.waitForFunction(key => !window.__testProtection().fullscreen.visual, KEY);
  assert.equal((await report(f)).fullscreen.virtual, true); await p.close();
});

test("invalid fullscreen rejects and MQL subscriptions receive virtual entry and exit", async () => {
  const p = await page();
  const result = await p.evaluate(async () => {
    const changes = [], legacy = [];
    const mql = matchMedia("(display-mode: fullscreen)"); mql.addEventListener("change", event => changes.push(event.matches));
    mql.addListener(event => legacy.push(event.matches));
    let invalid = false; try { await document.createElement("div").requestFullscreen(); } catch { invalid = true; }
    await document.getElementById("stage").requestFullscreen(); await new Promise(resolve => setTimeout(resolve, 30));
    await document.exitFullscreen(); return { invalid, changes, legacy, matches: mql.matches };
  });
  assert.equal(result.invalid, true); assert.deepEqual(result.changes, [true, false]); assert.deepEqual(result.legacy, [true, false]);
  assert.equal(result.matches, false); await p.close();
});

test("fullscreen compatibility preserves quoted/escaped selectors and native argument errors", async () => {
  const p = await page();
  const result = await p.evaluate(async () => {
    const node = document.createElement("div"); node.id = "literal:fullscreen"; node.dataset.value = ":fullscreen"; document.body.appendChild(node);
    await document.getElementById("stage").requestFullscreen();
    let errors = 0;
    for (const call of [() => document.querySelector(), () => document.querySelectorAll(), () => node.matches(), () => node.closest(), () => matchMedia()]) {
      try { call(); } catch { errors++; }
    }
    return { quoted: document.querySelector('[data-value=":fullscreen"]') === node,
      escaped: document.querySelector('#literal\\:fullscreen') === node, errors };
  });
  assert.equal(result.quoted, true); assert.equal(result.escaped, true); assert.equal(result.errors, 5); await p.close();
});

test("optional signals, exact-host exclusion and disable apply after reload", async () => {
  const p = await page(); const initial = (await command("GET_SETTINGS")).settings;
  await command("SAVE_SETTINGS", { settings: { ...initial, lifecycle: true, pointer: true } });
  await p.reload();
  const optional = await p.evaluate(() => {
    window.probeEvents.length = 0;
    document.dispatchEvent(new Event("freeze")); document.dispatchEvent(new Event("resume"));
    document.body.dispatchEvent(new MouseEvent("mouseleave", { relatedTarget: null }));
    return window.probeEvents;
  });
  assert.deepEqual(optional, []);
  await command("SAVE_SETTINGS", { settings: { ...initial, excludedHosts: ["127.0.0.1"] } }); await p.reload();
  assert.equal(await p.evaluate(key => Boolean(window.__testProtection()), KEY), false);
  await command("SAVE_SETTINGS", { settings: { ...initial, enabled: false } });
  await p.goto(`${otherBase}/demo/`);
  assert.equal(await p.evaluate(key => Boolean(window.__testProtection()), KEY), false);
  await command("SAVE_SETTINGS", { settings: initial });
  await p.close();
});

test("discard policy restores its original value when protection is disabled", async () => {
  const p = await page();
  const get = () => worker.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url)?.autoDiscardable, p.url());
  await p.waitForTimeout(50); assert.equal(await get(), false);
  const initial = (await command("GET_SETTINGS")).settings;
  await command("SAVE_SETTINGS", { settings: { ...initial, preventDiscard: false } });
  assert.equal(await get(), true);
  await command("SAVE_SETTINGS", { settings: initial }); await p.close();
});

test("window state minimize/restore keeps exposed API values stable", async t => {
  const p = await page(); const client = await context.newCDPSession(p);
  try {
    const { windowId } = await client.send("Browser.getWindowForTarget");
    await client.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "minimized" } });
    const r = await report(p);
    observations.minimized = { native: await realReadings(p), exposed: r.exposed };
    assert.equal(r.exposed.hidden, false); assert.equal(r.exposed.focus, true);
    await client.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "normal" } });
  } finally { await client.detach(); await p.close(); }
});

test("native fullscreen entry is redirected back to virtual fullscreen", async () => {
  const p = await page();
  await p.locator("#input").click();
  await worker.evaluate(async url => {
    const tab = (await chrome.tabs.query({})).find(tab => tab.url === url);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "ISOLATED",
      func: () => document.getElementById("stage").requestFullscreen() });
  }, p.url());
  await p.waitForFunction(key => window.__testProtection().fullscreen.virtual, KEY);
  assert.equal((await realReadings(p)).fullscreen, false);
  assert.equal((await report(p)).fullscreen.visual, true); await p.close();
});


test("visibility performance histories and buffered observers are filtered without hiding normal marks", async () => {
  const p = await page();
  const data = await p.evaluate(async () => {
    const seen = [], visibility = [];
    const observer = new PerformanceObserver(list => seen.push({
      all: list.getEntries().map(e => [e.name, e.entryType]),
      named: list.getEntriesByName("hidden").map(e => e.entryType),
      visibility: list.getEntriesByType("visibility-state").length
    }));
    observer.observe({ entryTypes: ["mark", "visibility-state"] });
    const buffered = new PerformanceObserver(list => visibility.push(list.getEntries().length));
    buffered.observe({ type: "visibility-state", buffered: true });
    performance.mark("hidden"); performance.mark("visible");
    await new Promise(resolve => setTimeout(resolve, 60));
    const result = { byType: performance.getEntriesByType("visibility-state").length,
      all: performance.getEntries().filter(e => e.entryType === "visibility-state").length,
      byName: performance.getEntriesByName("hidden").map(e => e.entryType), seen, visibility,
      records: buffered.takeRecords().length };
    observer.disconnect(); buffered.disconnect(); return result;
  });
  assert.equal(data.byType, 0); assert.equal(data.all, 0); assert.deepEqual(data.byName, ["mark"]);
  assert.ok(data.seen.some(batch => batch.named.includes("mark"))); assert.ok(data.seen.every(batch => batch.visibility === 0));
  assert.deepEqual(data.visibility, []); assert.equal(data.records, 0);
  const nativeCount = await worker.evaluate(async url => {
    const tab = (await chrome.tabs.query({})).find(t => t.url === url);
    return (await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "ISOLATED",
      func: () => performance.getEntriesByType("visibility-state").length }))[0].result;
  }, p.url());
  assert.ok(nativeCount > 0);
  observations.performanceV2 = { nativeCount, exposedCount: data.byType };
  await p.close();
});

test("virtual wake locks keep branded getters, release callbacks and idempotence", async () => {
  const p = await page();
  const data = await p.evaluate(async () => {
    const lock = await navigator.wakeLock.request("screen"), events = [];
    lock.onrelease = e => events.push({ released: lock.released, trusted: e.isTrusted });
    const before = { released: lock.released, type: lock.type, instance: lock instanceof WakeLockSentinel,
      prototypeReleased: Object.getOwnPropertyDescriptor(WakeLockSentinel.prototype, "released").get.call(lock) };
    let invalid = false; try { await navigator.wakeLock.request("system"); } catch { invalid = true; }
    await lock.release(); await lock.release(); await new Promise(r => setTimeout(r, 20));
    return { before, released: lock.released, events, invalid };
  });
  assert.deepEqual(data.before, { released: false, type: "screen", instance: true, prototypeReleased: false });
  assert.equal(data.released, true); assert.equal(data.events.length, 1); assert.equal(data.invalid, true);
  await p.close();
});

test("virtual idle detection respects threshold, abort, callbacks and virtual permission", async () => {
  const p = await page();
  const data = await p.evaluate(async () => {
    if (!window.IdleDetector) return { unsupported: true };
    const permission = await IdleDetector.requestPermission(), queried = (await navigator.permissions.query({ name: "idle-detection" })).state;
    const detector = new IdleDetector(), changes = [], controller = new AbortController();
    detector.onchange = () => changes.push([detector.userState, detector.screenState]);
    let invalid = false; try { await detector.start({ threshold: 100 }); } catch { invalid = true; }
    await detector.start({ threshold: 60000, signal: controller.signal });
    await new Promise(resolve => setTimeout(resolve, 20));
    const state = [detector.userState, detector.screenState]; controller.abort();
    const after = [detector.userState ?? null, detector.screenState ?? null];
    const aborted = new AbortController(); aborted.abort("cancelled");
    let reason; try { await new IdleDetector().start({ signal: aborted.signal }); } catch (e) { reason = e; }
    return { permission, queried, state, changes, after, invalid, reason };
  });
  assert.equal(data.unsupported, undefined);
  assert.equal(data.permission, "granted"); assert.equal(data.queried, "granted"); assert.equal(data.invalid, true);
  assert.deepEqual(data.state, ["active", "unlocked"]); assert.deepEqual(data.changes, [["active", "unlocked"]]);
  assert.deepEqual(data.after, [null, null]); assert.equal(data.reason, "cancelled");
  await p.close();
});

test("pointer lock stays virtual through Escape and cleans up on site exit or removal", async () => {
  const p = await page();
  await p.locator("#stage").evaluate(node => node.requestPointerLock());
  assert.equal(await p.evaluate(() => document.pointerLockElement?.id), "stage");
  const nativeLock = await worker.evaluate(async url => {
    const tab = (await chrome.tabs.query({})).find(t => t.url === url);
    return (await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "ISOLATED", func: () => Boolean(document.pointerLockElement) }))[0].result;
  }, p.url());
  assert.equal(nativeLock, false);
  await p.keyboard.press("Escape"); assert.equal(await p.evaluate(() => document.pointerLockElement?.id), "stage");
  await p.evaluate(() => document.exitPointerLock()); assert.equal(await p.evaluate(() => document.pointerLockElement), null);
  await p.locator("#input2").evaluate(node => node.requestPointerLock());
  await p.locator("#input2").evaluate(node => node.remove());
  await p.waitForFunction(() => document.pointerLockElement === null);
  await p.close();
});

test("focus selectors, dynamic CSSOM and closed shadow styles preserve element focus", async () => {
  const p = await page();
  await p.locator("#input").focus();
  const first = await p.evaluate(() => ({
    focused: document.querySelector(":focus")?.id,
    within: document.body.matches(":focus-within"),
    literal: (() => { const n = document.createElement("div"); n.dataset.test = ":focus"; document.body.appendChild(n); return document.querySelector('[data-test=":focus"]') === n; })()
  }));
  assert.deepEqual(first, { focused: "input", within: true, literal: true });
  await p.locator("#input2").focus();
  assert.equal(await p.locator("#input").evaluate(n => n.matches(":focus")), false);
  const shadow = await p.evaluate(async () => {
    const host = document.createElement("div"); document.body.appendChild(host);
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = '<style>input:focus{color:rgb(12,34,56)}</style><input id="closed-input">';
    await new Promise(r => setTimeout(r, 60));
    const input = root.querySelector("input"); input.focus();
    return { matched: root.querySelector(":focus") === input, within: host.matches(":focus-within"), color: getComputedStyle(input).color };
  });
  assert.deepEqual(shadow, { matched: true, within: true, color: "rgb(12, 34, 56)" });
  await p.close();
});

test("compound fullscreen media and CSSOM updates follow virtual state and viewport", async () => {
  const p = await page();
  await p.evaluate(() => {
    window.compoundChanges = [];
    window.compound = matchMedia("screen and (display-mode: fullscreen) and (min-width: 800px)");
    compound.addEventListener("change", e => compoundChanges.push(e.matches));
  });
  await p.locator("#enter").click();
  assert.equal(await p.evaluate(() => compound.matches), true);
  await p.evaluate(() => document.styleSheets[0].insertRule("#stage:fullscreen{color:rgb(11,22,33)}", document.styleSheets[0].cssRules.length));
  await p.waitForFunction(() => getComputedStyle(document.getElementById("stage")).color === "rgb(11, 22, 33)");
  await p.setViewportSize({ width: 600, height: 800 });
  await p.waitForFunction(() => compound.matches === false && compoundChanges.includes(false));
  await p.setViewportSize({ width: 1100, height: 800 });
  await p.waitForFunction(() => compound.matches === true);
  const modes = await p.evaluate(() => ({
    browser: matchMedia("(display-mode: browser) and (min-width: 1px)").matches,
    not: matchMedia("not all and (display-mode: fullscreen)").matches,
    or: matchMedia("(display-mode: browser), (min-width: 100px)").matches
  }));
  assert.deepEqual(modes, { browser: false, not: false, or: true });
  await p.evaluate(() => document.exitFullscreen());
  assert.equal(await p.evaluate(() => compound.matches), false);
  await p.close();
});

test("capture policy denies new media and screen-detail requests without native prompts", async () => {
  const p = await page(), initial = (await command("GET_SETTINGS")).settings;
  await command("SAVE_SETTINGS", { settings: { ...initial, capture: true } }); await p.reload();
  const data = await p.evaluate(async () => {
    const requests = [];
    for (const name of ["getUserMedia", "getDisplayMedia"]) try { await navigator.mediaDevices[name]({ video: true }); requests.push("allowed"); } catch (e) { requests.push(e.name); }
    let screenDetails; try { await window.getScreenDetails(); screenDetails = "allowed"; } catch (e) { screenDetails = e.name; }
    return { requests, screenDetails, isExtended: screen.isExtended, camera: (await navigator.permissions.query({ name: "camera" })).state };
  });
  assert.deepEqual(data.requests, ["NotAllowedError", "NotAllowedError"]); assert.equal(data.screenDetails, "NotAllowedError");
  assert.equal(data.isExtended, false); assert.equal(data.camera, "denied");
  await command("SAVE_SETTINGS", { settings: initial }); await p.close();
});

test("network rules block only explicit tracking prefixes and are removed when disabled", async () => {
  const p = await page(), initial = (await command("GET_SETTINGS")).settings;
  await command("SAVE_SETTINGS", { settings: { ...initial, network: true, trackerUrls: [base + "/blank?tracking*"] } });
  const readings = await p.evaluate(async () => {
    let blocked = false; try { await fetch("/blank?tracking=1"); } catch { blocked = true; }
    return { blocked, allowed: (await fetch("/blank?other=1")).ok };
  });
  assert.deepEqual(readings, { blocked: true, allowed: true });
  await command("SAVE_SETTINGS", { settings: { ...initial, network: false } });
  assert.equal(await p.evaluate(async () => (await fetch("/blank?tracking=1")).ok), true);
  assert.equal(await worker.evaluate(async () => (await chrome.declarativeNetRequest.getDynamicRules()).length), 0);
  await command("SAVE_SETTINGS", { settings: initial }); await p.close();
});

test("popup shows actual application and reload-required status, and tab badge follows it", async () => {
  const p = await page(), initial = (await command("GET_SETTINGS")).settings;
  const tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(t => t.url === url).id, p.url());
  assert.equal((await command("STATUS", { tabId })).status.state, "applied");
  assert.equal(await worker.evaluate(id => chrome.action.getBadgeText({ tabId: id }), tabId), "OK");
  const popup = await context.newPage(); await popup.goto("chrome-extension://" + extensionId + "/popup/popup.html?tabId=" + tabId);
  await popup.waitForFunction(() => document.getElementById("application").classList.contains("applied"));
  await popup.screenshot({ path: path.join(root, "test-results", "popup-v2-applied.png"), fullPage: true });
  await command("SAVE_SETTINGS", { settings: { ...initial, wakeLock: false } });
  assert.equal((await command("STATUS", { tabId })).status.state, "reload");
  await popup.locator("#refresh").click(); await popup.waitForFunction(() => document.getElementById("application").classList.contains("reload"));
  await popup.screenshot({ path: path.join(root, "test-results", "popup-v2-reload.png"), fullPage: true });
  await p.reload();
  assert.equal((await command("STATUS", { tabId })).status.state, "applied");
  await command("SAVE_SETTINGS", { settings: { ...initial, excludedHosts: ["127.0.0.1"] } }); await p.reload();
  assert.equal((await command("STATUS", { tabId })).status.state, "disabled");
  assert.equal(await worker.evaluate(id => chrome.action.getBadgeText({ tabId: id }), tabId), "OFF");
  await command("SAVE_SETTINGS", { settings: initial }); await popup.close(); await p.close();
});



test("shadow fullscreen and pointer-lock getters retarget across nested roots", async () => {
  const p = await page();
  const result = await p.evaluate(async () => {
    const host = document.createElement("div"); host.id = "outer"; document.body.appendChild(host);
    const outer = host.attachShadow({ mode: "closed" }), innerHost = document.createElement("div"); innerHost.id = "inner";
    outer.appendChild(innerHost);
    const inner = innerHost.attachShadow({ mode: "closed" }), target = document.createElement("div"); target.id = "target"; inner.appendChild(target);
    await target.requestFullscreen();
    const fullscreen = [document.fullscreenElement?.id, outer.fullscreenElement?.id, inner.fullscreenElement?.id];
    await document.exitFullscreen();
    await target.requestPointerLock();
    const pointer = [document.pointerLockElement?.id, outer.pointerLockElement?.id, inner.pointerLockElement?.id];
    document.exitPointerLock();
    return { fullscreen, pointer };
  });
  assert.deepEqual(result.fullscreen, ["outer", "inner", "target"]); assert.deepEqual(result.pointer, ["outer", "inner", "target"]);
  await p.close();
});



test("CSP-blocked stylesheet mirrors report partial instead of full application", async () => {
  const p = await page(); await p.goto(base + "/csp");
  await p.evaluate(() => document.getElementById("stage").requestFullscreen());
  await p.waitForFunction(() => window.__testProtection().failures.some(error => error.includes("stylesheet mirror")));
  const id = await worker.evaluate(async url => (await chrome.tabs.query({})).find(t => t.url === url).id, p.url());
  assert.equal((await command("STATUS", { tabId: id })).status.state, "partial");
  await p.close();
});


test("restore-site UI commits an exception before reload and restores native APIs and requests", async () => {
  const p = await page(), initial = (await command("GET_SETTINGS")).settings;
  await command("SAVE_SETTINGS", { settings: { ...initial, capture: true, network: true, trackerUrls: [base + "/blank?tracking*"] } });
  await p.reload();
  assert.equal(await p.evaluate(async () => { try { await fetch("/blank?tracking=1"); return false; } catch { return true; } }), true);
  const tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(t => t.url === url).id, p.url());
  const popup = await context.newPage(); await popup.goto(`chrome-extension://${extensionId}/popup/popup.html?tabId=${tabId}`);
  await popup.waitForFunction(() => document.getElementById("application").classList.contains("applied") && !document.getElementById("restoreSite").disabled);
  await popup.locator("#restoreSite").click();
  await p.waitForFunction(() => window.__testProtection() === null);
  await popup.waitForFunction(() => document.getElementById("application").classList.contains("disabled") && document.getElementById("notice").classList.contains("success"));
  assert.equal(await p.evaluate(() => [Document.prototype.hasFocus, Element.prototype.requestFullscreen, MediaDevices.prototype.getUserMedia].every(fn => Function.prototype.toString.call(fn).includes("[native code]"))), true);
  assert.equal(await p.evaluate(async () => (await fetch("/blank?tracking=1")).ok), true);
  assert.equal((await command("STATUS", { tabId })).discard.requested, false);
  const saved = (await command("GET_SETTINGS")).settings;
  assert.equal(saved.enabled, true); assert.equal(saved.capture, true); assert.equal(saved.network, true);
  assert.ok(saved.excludedHosts.includes("127.0.0.1"));
  assert.equal(await worker.evaluate(id => chrome.action.getBadgeText({ tabId: id }), tabId), "OFF");
  await popup.screenshot({ path: path.join(root, "test-results", "popup-v21-restored.png"), fullPage: true });
  const frameNavigation = p.waitForEvent("framenavigated", { predicate: f => f.url().includes("localhost") });
  await p.evaluate(other => { const iframe = document.createElement("iframe"); iframe.src = other + "/demo/frame.html"; document.body.appendChild(iframe); }, otherBase);
  const frame = await frameNavigation;
  await frame.waitForFunction(() => Boolean(window.__testProtection()?.installed));
  const state = (await command("STATUS", { tabId })).status;
  assert.equal(state.state, "disabled"); assert.match(state.description, /Khung khác nguồn/);
  await command("SAVE_SETTINGS", { settings: initial }); await popup.close(); await p.close();
});

test("restore-site refuses a stale popup URL without changing settings or reloading", async () => {
  const p = await page(), initial = (await command("GET_SETTINGS")).settings;
  const tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(t => t.url === url).id, p.url());
  await p.evaluate(() => { window.restoreNavigationMarker = "unchanged"; });
  const popup = await context.newPage(); await popup.goto(`chrome-extension://${extensionId}/popup/popup.html?tabId=${tabId}`);
  const result = await popup.evaluate(async args => chrome.runtime.sendMessage({ type: "RESTORE_SITE", ...args }), { tabId, expectedUrl: base + "/old-address" });
  assert.equal(result.ok, false); assert.match(result.error, /Trang đã thay đổi/);
  assert.deepEqual((await command("GET_SETTINGS")).settings, initial);
  assert.equal(await p.evaluate(() => window.restoreNavigationMarker), "unchanged");
  assert.equal((await report(p)).installed, true);
  await popup.close(); await p.close();
});

test("callable wrappers preserve API metadata and leave Function.toString untouched", async () => {
  const p = await page();
  const read = () => {
    const entries = [[Document.prototype,"hidden","get"],[Document.prototype,"visibilityState","get"],[Document.prototype,"hasFocus","value"],[Document.prototype,"fullscreenElement","get"],[Document.prototype,"exitFullscreen","value"],[Element.prototype,"requestFullscreen","value"],[Document.prototype,"querySelector","value"],[Element.prototype,"matches","value"],[window,"matchMedia","value"]];
    return entries.map(([owner,name,kind]) => {
      const d = Object.getOwnPropertyDescriptor(owner,name), fn = d[kind];
      let constructable = true; try { Reflect.construct(String,[],fn); } catch { constructable = false; }
      return { key:name,name:fn.name,length:fn.length,keys:Reflect.ownKeys(fn).map(String),configurable:d.configurable,enumerable:d.enumerable,writable:d.writable ?? null,constructable,nativeSource:/\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(fn)) };
    });
  };
  const main = await p.evaluate(read);
  const tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(t=>t.url===url).id,p.url());
  const original = await worker.evaluate(async id => (await chrome.scripting.executeScript({target:{tabId:id},world:"ISOLATED",func:()=>{
    const entries=[[Document.prototype,"hidden","get"],[Document.prototype,"visibilityState","get"],[Document.prototype,"hasFocus","value"],[Document.prototype,"fullscreenElement","get"],[Document.prototype,"exitFullscreen","value"],[Element.prototype,"requestFullscreen","value"],[Document.prototype,"querySelector","value"],[Element.prototype,"matches","value"],[window,"matchMedia","value"]];
    return entries.map(([owner,name,kind])=>{const d=Object.getOwnPropertyDescriptor(owner,name),fn=d[kind];let constructable=true;try{Reflect.construct(String,[],fn);}catch{constructable=false;}return {key:name,name:fn.name,length:fn.length,keys:Reflect.ownKeys(fn).map(String),configurable:d.configurable,enumerable:d.enumerable,writable:d.writable ?? null,constructable,nativeSource:/\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(fn))};});
  }}))[0].result,tabId);
  assert.deepEqual(main,original);
  assert.equal(await p.evaluate(()=>Function.prototype.toString.toString()),"function toString() { [native code] }");
  assert.equal(await p.evaluate(()=>{try{new Document.prototype.hasFocus();return false;}catch(e){return e instanceof TypeError;}}),true);
  await p.close();
});

test("fullscreen custom-property proof stays consistent after Escape without restoring fullscreen geometry", async () => {
  const p = await page();
  await p.evaluate(() => {
    const style = document.createElement("style"); style.textContent = "#proof{--render:0}:root:fullscreen #proof{--render:1}"; document.head.appendChild(style);
    const proof = document.createElement("div"); proof.id="proof"; document.body.appendChild(proof);
  });
  await p.evaluate(()=>document.documentElement.requestFullscreen());
  await p.waitForFunction(()=>getComputedStyle(document.getElementById("proof")).getPropertyValue("--render").trim()==="1");
  assert.equal(await p.evaluate(()=>["data-presence-shield-fullscreen","data-presence-shield-fullscreen-visual"].some(name=>document.documentElement.hasAttribute(name))),false);
  await p.keyboard.press("Escape");
  assert.equal((await report(p)).fullscreen.visual,false); assert.equal((await report(p)).fullscreen.virtual,true);
  assert.equal(await p.evaluate(()=>getComputedStyle(document.getElementById("proof")).getPropertyValue("--render").trim()),"1");
  await p.evaluate(()=>document.exitFullscreen());
  assert.equal(await p.evaluate(()=>getComputedStyle(document.getElementById("proof")).getPropertyValue("--render").trim()),"0");
  await p.close();
});

test("optional passive observer policy preserves real typing, local handlers, clicks and selections", async () => {
  const p = await page(), initial=(await command("GET_SETTINGS")).settings;
  await command("SAVE_SETTINGS",{settings:{...initial,passiveEvents:true,pointer:true}}); await p.reload();
  await p.evaluate(()=>{
    window.observerTest={global:0,property:0,local:0,input:0,enter:0};
    const listener={handleEvent(){window.observerTest.global++;}};
    document.addEventListener("keydown",listener); document.removeEventListener("keydown",listener); document.addEventListener("keydown",listener);
    window.keyHandler=()=>window.observerTest.property++; document.onkeyup=window.keyHandler;
    const input=document.getElementById("input"); input.addEventListener("keydown",()=>window.observerTest.local++);
    document.addEventListener("input",()=>window.observerTest.input++);
    document.documentElement.addEventListener("pointerenter",()=>window.observerTest.enter++);
    document.documentElement.dispatchEvent(new MouseEvent("pointerenter",{relatedTarget:null}));
  });
  await p.locator("#input").pressSequentially("abc");
  assert.equal(await p.locator("#input").inputValue(),"abc");
  assert.deepEqual(await p.evaluate(()=>window.observerTest),{global:0,property:0,local:3,input:3,enter:0});
  assert.equal(await p.evaluate(()=>document.onkeyup===window.keyHandler),true);
  const selected=await p.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.getElementById("stage"));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);return {masked:selection.toString(),real:range.toString()};});
  assert.equal(selected.masked,""); assert.ok(selected.real.length>0);
  const clipboard=await p.evaluate(async()=>{let denied;try{await navigator.clipboard.readText();denied=false;}catch(e){denied=e.name;}return {denied,permission:(await navigator.permissions.query({name:"clipboard-read"})).state};});
  assert.deepEqual(clipboard,{denied:"NotAllowedError",permission:"denied"});
  await p.locator("#enter").click(); assert.equal((await report(p)).fullscreen.virtual,true);
  await command("SAVE_SETTINGS",{settings:initial}); await p.close();
});

test("BroadcastChannel isolation prevents cross-document discovery but preserves communication inside a document", async () => {
  const p=await page(),initial=(await command("GET_SETTINGS")).settings;
  await command("SAVE_SETTINGS",{settings:{...initial,tabIsolation:true}}); await p.reload();
  const other=await page();
  const self=await p.evaluate(()=>new Promise(resolve=>{const a=new BroadcastChannel("same"),b=new BroadcastChannel("same");b.onmessage=e=>{a.close();b.close();resolve({data:e.data,name:b.name});};a.postMessage("self");}));
  assert.deepEqual(self,{data:"self",name:"same"});
  await other.evaluate(()=>{window.peerReceived=[];window.peerChannel=new BroadcastChannel("cross");peerChannel.onmessage=e=>peerReceived.push(e.data);});
  await p.evaluate(()=>{window.senderChannel=new BroadcastChannel("cross");senderChannel.postMessage("remote");});
  await other.waitForTimeout(150); assert.deepEqual(await other.evaluate(()=>peerReceived),[]);
  assert.equal(await p.evaluate(()=>{try{new BroadcastChannel(Symbol());return false;}catch(e){return e instanceof TypeError;}}),true);
  await command("SAVE_SETTINGS",{settings:initial}); await other.close(); await p.close();
});

test("optional geometry snapshots stay stable while native layout and ResizeObserver remain genuine", async () => {
  const p=await page(),initial=(await command("GET_SETTINGS")).settings;
  await command("SAVE_SETTINGS",{settings:{...initial,geometry:true}}); await p.reload();
  const before=await p.evaluate(()=>({width:innerWidth,height:innerHeight,visual:visualViewport.width,x:screenX,screen:screen.width}));
  await p.evaluate(()=>{window.resizeEvents=0;window.addEventListener("resize",()=>resizeEvents++);});
  await p.setViewportSize({width:900,height:600});
  await p.waitForFunction(()=>document.documentElement.clientWidth===900);
  assert.deepEqual(await p.evaluate(()=>({width:innerWidth,height:innerHeight,visual:visualViewport.width,x:screenX,screen:screen.width})),before);
  assert.equal(await p.evaluate(()=>resizeEvents),0);
  const id=await worker.evaluate(async url=>(await chrome.tabs.query({})).find(t=>t.url===url).id,p.url());
  const actual=await worker.evaluate(async id=>(await chrome.scripting.executeScript({target:{tabId:id},world:"ISOLATED",func:()=>({width:innerWidth,visual:visualViewport.width})}))[0].result,id);
  assert.equal(actual.width,900); assert.equal(actual.visual,900);
  await command("SAVE_SETTINGS",{settings:initial}); await p.close();
});

test("MutationObserver filters only private markers and stylesheet nodes while keeping page edits", async () => {
  const p=await page(),initial=(await command("GET_SETTINGS")).settings;
  await command("SAVE_SETTINGS",{settings:{...initial,domPrivacy:true}}); await p.reload();
  const data=await p.evaluate(async()=>{
    const seen=[];let receiver=true;
    const observer=new MutationObserver(function(records,instance){receiver&&=this===instance;seen.push(...records.map(r=>({type:r.type,attribute:r.attributeName,nodes:[...r.addedNodes].map(n=>n.nodeName)})));});
    observer.observe(document,{attributes:true,childList:true,subtree:true});
    document.getElementById("input").focus();document.body.setAttribute("data-page-edit","yes");
    const aside=document.createElement("aside");document.body.appendChild(aside);
    document.body.style.setProperty("padding","3px");
    await document.getElementById("stage").requestFullscreen();
    document.body.style.setProperty("border","1px solid red");
    await new Promise(resolve=>setTimeout(resolve,80));observer.disconnect();
    const pending=new MutationObserver(()=>{});pending.observe(document,{attributes:true,subtree:true});
    document.getElementById("input2").focus();document.body.setAttribute("data-page-pending","yes");
    const queued=pending.takeRecords().map(r=>r.attributeName);pending.disconnect();
    return {seen,queued,receiver};
  });
  assert.equal(data.receiver,true);
  assert.ok(data.seen.some(r=>r.attribute==="data-page-edit")); assert.ok(data.seen.some(r=>r.nodes.includes("ASIDE")));
  assert.equal(data.seen.some(r=>/^data-[a-f0-9]{24}$/.test(r.attribute||"")),false);
  assert.equal(data.seen.filter(r=>r.attribute==="style").length,2);
  assert.deepEqual(data.queued,["data-page-pending"]);
  await command("SAVE_SETTINGS",{settings:initial}); await p.close();
});

test("popup loads, settings are saved and no page errors were recorded", async () => {
  await start();
  const popup = await context.newPage(); await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  await popup.waitForFunction(() => !document.getElementById("enabled").disabled);
  assert.equal(await popup.locator("#enabled").isChecked(), true);
  await popup.screenshot({ path: path.join(root, "test-results", "popup.png"), fullPage: true });
  await popup.close(); assert.deepEqual(errors, []);
});

after(async () => {
  fs.mkdirSync(path.join(root, "test-results"), { recursive: true });
  fs.writeFileSync(path.join(root, "test-results", "browser-errors.json"), JSON.stringify(errors));
  fs.writeFileSync(path.join(root, "test-results", "native-observations.json"), JSON.stringify(observations, null, 2));
  if (context) await context.close(); if (server) await new Promise(resolve => server.close(resolve));
  // Retain the isolated temporary profile; never touch the user's browser profile.
});
