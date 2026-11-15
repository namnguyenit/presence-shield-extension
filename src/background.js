import { DEFAULTS, normalizeSettings, registrations } from "./settings.js";
import { CONTROL_EVENT } from "./protocol.js";
import { applicationStatus } from "./status.js";

let queue = Promise.resolve();
const discardOriginal = new Map();

async function getSettings() {
  return normalizeSettings((await chrome.storage.local.get("settings")).settings);
}

async function commitSettings(settings) {
  const previous = await getSettings();
  try {
    await synchronize(settings);
    await chrome.storage.local.set({ settings });
  } catch (error) {
    await synchronize(previous);
    throw error;
  }
}

async function synchronize(settings) {
  const desired = registrations(settings);
  const existing = await chrome.scripting.getRegisteredContentScripts();
  const ours = existing.filter(item => item.id.startsWith("ps-"));
  const desiredIds = new Set(desired.map(item => item.id));
  const remove = ours.filter(item => !desiredIds.has(item.id)).map(item => item.id);
  if (remove.length) await chrome.scripting.unregisterContentScripts({ ids: remove });
  const existingIds = new Set(ours.map(item => item.id));
  const update = desired.filter(item => existingIds.has(item.id));
  const add = desired.filter(item => !existingIds.has(item.id));
  if (update.length) await chrome.scripting.updateContentScripts(update);
  if (add.length) await chrome.scripting.registerContentScripts(add);
  await syncNetwork(settings);
  await syncDiscard(settings);
  for (const tab of await chrome.tabs.query({})) await tabStatus(tab, settings);
}

async function syncNetwork(settings) {
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  const addRules = settings.enabled && settings.network ? settings.trackerUrls.map((url, index) => {
    const wildcard = url.endsWith("*");
    const literal = wildcard ? url.slice(0, -1) : url;
    const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { id: index + 1, priority: 1, action: { type: "block" }, condition: {
      regexFilter: "^" + escaped + (wildcard ? "" : "$"), isUrlFilterCaseSensitive: true,
      ...(settings.excludedHosts.length ? { excludedInitiatorDomains: settings.excludedHosts } : {})
    } };
  }) : [];
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: old.map(rule => rule.id), addRules });
}

async function tabStatus(tab, settings = null) {
  settings ||= await getSettings();
  try { tab = await chrome.tabs.get(tab.id); } catch { /* Closed tab. */ }
  let frames = [], readError = "";
  if (/^https?:/.test(tab.url || "")) try { frames = await inFrames(tab.id); } catch (error) { readError = error.message; }
  const status = applicationStatus(settings, frames, tab.url, readError);
  if (status.state === "applied" && frames.some(frame => !frame.result.native)) {
    status.state = "unknown"; status.title = "Cần kiểm tra lại";
    status.description = "Trang hoặc khung thay đổi trong lúc đọc trạng thái. Bấm Kiểm tra lại.";
  }
  const discard = { requested: protectsTab(tab, settings), active: tab.autoDiscardable === false };
  if (status.state === "applied" && discard.requested && !discard.active) {
    status.state = "partial"; status.title = "Đã áp dụng một phần";
    status.description = "Các lớp trong trang đã cài; chưa xác nhận hạn chế tự loại bỏ tab.";
  }
  const badges = { applied: ["OK", "#16876b"], partial: ["!", "#be7418"], reload: ["↻", "#be7418"], missing: ["?", "#be7418"], disabled: ["OFF", "#64748b"], restricted: ["", "#64748b"], unknown: ["?", "#64748b"] };
  const [text, color] = badges[status.state];
  try { await chrome.action.setBadgeText({ tabId: tab.id, text }); await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color }); } catch { /* Closed tab. */ }
  return { frames, status, discard, network: { enabled: settings.enabled && settings.network, rules: settings.enabled && settings.network ? settings.trackerUrls.length : 0 } };
}

function enqueue(task) {
  const next = queue.then(task, task);
  queue = next.catch(error => console.error("Presence Shield:", error));
  return next;
}

function protectsTab(tab, settings) {
  try {
    const url = new URL(tab.url);
    return settings.enabled && settings.presence && settings.preventDiscard &&
      ["http:", "https:"].includes(url.protocol) && !settings.excludedHosts.includes(url.hostname);
  } catch { return false; }
}

async function setDiscard(tab, settings) {
  if (protectsTab(tab, settings)) {
    if (!discardOriginal.has(tab.id)) {
      discardOriginal.set(tab.id, tab.autoDiscardable !== false);
      await chrome.storage.session.set({ discardOriginal: Object.fromEntries(discardOriginal) });
    }
    if (tab.autoDiscardable !== false) await chrome.tabs.update(tab.id, { autoDiscardable: false });
  } else if (discardOriginal.has(tab.id)) {
    const original = discardOriginal.get(tab.id);
    await chrome.tabs.update(tab.id, { autoDiscardable: original });
    discardOriginal.delete(tab.id);
    await chrome.storage.session.set({ discardOriginal: Object.fromEntries(discardOriginal) });
  }
}

async function syncDiscard(settings) {
  const tabs = await chrome.tabs.query({});
  const ids = new Set(tabs.map(tab => tab.id));
  for (const id of discardOriginal.keys()) if (!ids.has(id)) discardOriginal.delete(id);
  for (const tab of tabs) {
    try { await setDiscard(tab, settings); } catch { /* Tab may close during synchronization. */ }
  }
}

const ready = enqueue(async () => {
  const session = (await chrome.storage.session.get("discardOriginal")).discardOriginal || {};
  for (const [id, value] of Object.entries(session)) discardOriginal.set(Number(id), value);
  const saved = await chrome.storage.local.get("settings");
  if (!saved.settings) await chrome.storage.local.set({ settings: { ...DEFAULTS } });
  await synchronize(await getSettings());
});

chrome.runtime.onInstalled.addListener(() => enqueue(async () => synchronize(await getSettings())));
chrome.runtime.onStartup.addListener(() => enqueue(async () => synchronize(await getSettings())));
chrome.tabs.onUpdated.addListener((id, change, tab) => {
  if (change.url || change.status === "complete") enqueue(async () => {
    const settings = await getSettings(); await setDiscard(tab, settings); await tabStatus(tab, settings);
  });
});
chrome.tabs.onRemoved.addListener(id => {
  enqueue(async () => {
    discardOriginal.delete(id);
    await chrome.storage.session.set({ discardOriginal: Object.fromEntries(discardOriginal) });
  });
});

async function inFrames(tabId, action = "status") {
  const frames = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: "MAIN",
    func: (action, eventName) => {
      const detail = { action, result: null };
      window.dispatchEvent(new CustomEvent(eventName, { detail }));
      if (detail.result) return detail.result;
      // Existing v1 documents need a reload; do not inject new patches over old ones.
      const legacy = globalThis[Symbol.for("PresenceShield.runtime.v1")];
      if (legacy) return { ...legacy.report(), version: "1.0.0", signature: "legacy" };
      return { installed: false, href: location.href };
    },
    args: [action, CONTROL_EVENT]
  });
  const nativeFrames = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true }, world: "ISOLATED",
    func: () => ({ hidden: document.hidden, visibility: document.visibilityState,
      focus: document.hasFocus(), fullscreen: Boolean(document.fullscreenElement) })
  });
  return frames.map(frame => ({ ...frame, result: { ...frame.result,
    native: nativeFrames.find(item => item.documentId === frame.documentId)?.result || null } }));
}

chrome.commands.onCommand.addListener(async command => {
  if (command !== "collapse-fullscreen") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) try { await inFrames(tab.id, "collapse"); } catch { /* Restricted browser page. */ }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Options and popup may also be opened as a full extension tab.
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL("popup/"))) return false;
  (async () => {
    await ready;
    switch (message?.type) {
      case "GET_SETTINGS": return { settings: await getSettings() };
      case "SAVE_SETTINGS": return enqueue(async () => {
        const settings = normalizeSettings(message.settings);
        await commitSettings(settings);
        return { settings, reloadRequired: true };
      });
      case "RESTORE_SITE": return enqueue(async () => {
        const tab = await chrome.tabs.get(message.tabId);
        if (!message.expectedUrl || tab.url !== message.expectedUrl) throw new Error("Trang đã thay đổi. Kiểm tra lại website trước khi khôi phục API.");
        const url = new URL(tab.url);
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("Chỉ khôi phục được website HTTP/HTTPS.");
        const previous = await getSettings();
        const settings = normalizeSettings({ ...previous, excludedHosts: [...previous.excludedHosts, url.hostname] });
        if (!settings.excludedHosts.includes(url.hostname)) throw new Error("Không thể thêm ngoại lệ cho tên miền này; hãy kiểm tra giới hạn danh sách ngoại lệ.");
        await commitSettings(settings);
        // Reload only after registration, network/discard policy and storage have committed.
        // A stale popup must never reload an unrelated document after the user navigates.
        const latest = await chrome.tabs.get(tab.id);
        if (latest.url !== tab.url) return { settings, reloaded: false, reloadError: "Ngoại lệ đã lưu, nhưng trang đã chuyển địa chỉ. Không tải lại trang mới." };
        try { await chrome.tabs.reload(tab.id); }
        catch (error) { return { settings, reloaded: false, reloadError: "Ngoại lệ đã lưu; chưa tải lại được trang: " + error.message }; }
        return { settings, reloaded: true, hostname: url.hostname };
      });
      case "STATUS": return tabStatus(await chrome.tabs.get(message.tabId));
      case "COLLAPSE": return { frames: await inFrames(message.tabId, "collapse") };
      case "RESET": return { frames: await inFrames(message.tabId, "reset") };
      default: throw new Error("Yêu cầu không được hỗ trợ.");
    }
  })().then(value => sendResponse({ ok: true, ...value }), error => sendResponse({ ok: false, error: error.message }));
  return true;
});
