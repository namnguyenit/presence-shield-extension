import { FEATURE_KEYS, normalizeSettings } from "../src/settings.js";
const $ = id => document.getElementById(id);
const settingKeys = ["enabled", ...FEATURE_KEYS, "preventDiscard", "network"];
const labels = { presence: "Hiển thị và focus", performance: "Lịch sử chuyển tab", fullscreen: "Fullscreen giả lập", focusCss: "Focus trong CSS", wakeLock: "Wake Lock ảo", idle: "Idle Detection ảo", pointerLock: "Pointer Lock ảo", screenInfo: "Thông tin màn hình", lifecycle: "Lifecycle / discard", pointer: "Con trỏ rời trang", capture: "Chặn camera / capture", passiveEvents: "Quan sát tương tác toàn trang", tabIsolation: "Tách BroadcastChannel", geometry: "Kích thước / vị trí ổn định", domPrivacy: "Marker / stylesheet riêng" };
let settings, tab, host, saving = false, checking = false;
function readHost() {
  host = undefined;
  try { const url = new URL(tab.url); if (["https:", "http:"].includes(url.protocol)) host = url.hostname; } catch {}
}
function notice(message, kind = "") { $("notice").textContent = message; $("notice").className = kind; }
async function request(type, extra = {}) {
  const result = await chrome.runtime.sendMessage({ type, ...extra });
  if (!result?.ok) throw new Error(result?.error || "Không thể liên lạc với tiện ích.");
  return result;
}
function paint() {
  for (const key of settingKeys) $(key).checked = settings[key];
  $("host").textContent = host || "Trang nội bộ trình duyệt";
  $("siteToggle").disabled = !host || saving;
  $("siteToggle").textContent = settings.excludedHosts.includes(host) ? "Bật cho tên miền này" : "Tắt cho tên miền này";
  $("compatibility").hidden = !host;
  $("restoreSite").disabled = !host || saving;
  $("restoreSite").textContent = settings.excludedHosts.includes(host) ? "Tải lại để dùng API gốc" : "Khôi phục API gốc và tải lại";
  $("trackerUrls").value = settings.trackerUrls.join("\n");
}
function paintStatus(status) {
  $("application").className = "application " + status.state;
  $("applicationTitle").textContent = status.title;
  $("applicationDescription").textContent = status.description;
  $("limits").replaceChildren(...(status.limits || []).map(text => { const li = document.createElement("li"); li.textContent = text; return li; }));
}
async function refresh() {
  if (!tab?.id || checking || saving) return;
  checking = true; $("refresh").disabled = true;
  $("restoreSite").disabled = true;
  try {
    const previousUrl = tab.url;
    tab = await chrome.tabs.get(tab.id); readHost();
    if (tab.url !== previousUrl) paint();
    const result = await request("STATUS", { tabId: tab.id });
    const { frames, status, network } = result;
    paintStatus(status);
    const top = frames.find(frame => frame.frameId === 0)?.result;
    const offHere = !settings.enabled || settings.excludedHosts.includes(host);
    $("layers").replaceChildren(...FEATURE_KEYS.map(key => {
      const row = document.createElement("div"); row.className = "layer";
      const name = document.createElement("span"), state = document.createElement("span"); name.textContent = labels[key];
      state.textContent = top?.features?.[key] ? top.capabilities?.[key] === false ? "Không có API này" : "Đã cài" : offHere ? "Tắt cho website" : settings[key] ? "Chưa áp dụng" : "Tắt";
      state.className = top?.features?.[key] ? "installed" : !offHere && settings[key] ? "failed" : "";
      row.append(name, state); return row;
    }));
    $("status").textContent = status.installedFrames + "/" + status.frames + " khung đọc được có lớp bảo vệ.";
    $("diagnostics").textContent = JSON.stringify(result, null, 2);
    $("networkStatus").textContent = network.enabled ? settings.excludedHosts.includes(host) ? "Quy tắc mạng đang bật; tên miền này có ngoại lệ theo nguồn request." : "Đang bật · " + network.rules + " địa chỉ được chặn." : "Quy tắc mạng đang tắt.";
  } catch (error) {
    paintStatus({ state: "unknown", title: "Chưa xác minh được", description: error.message });
  } finally { checking = false; $("refresh").disabled = false; $("restoreSite").disabled = !host || saving; }
}
async function save(next) {
  saving = true;
  for (const key of settingKeys) $(key).disabled = true;
  $("siteToggle").disabled = true; $("extended").disabled = true; $("saveUrls").disabled = true;
  $("restoreSite").disabled = true;
  try {
    settings = (await request("SAVE_SETTINGS", { settings: next })).settings;
    notice("Đã lưu. Các lớp trên trang cần tải lại để nhận cấu hình mới.", "success");
  } catch (error) { notice(error.message, "error"); }
  finally {
    saving = false; for (const key of settingKeys) $(key).disabled = false;
    $("extended").disabled = false; $("saveUrls").disabled = false; paint(); await refresh();
  }
}
for (const key of settingKeys) $(key).addEventListener("change", () => { if (settings && !saving) save({ ...settings, [key]: $(key).checked }); });
$("extended").addEventListener("click", () => save({ ...settings, ...Object.fromEntries(FEATURE_KEYS.map(key => [key, true])), enabled: true, preventDiscard: true }));
$("siteToggle").addEventListener("click", () => {
  if (!host || saving) return;
  const excludedHosts = settings.excludedHosts.includes(host) ? settings.excludedHosts.filter(item => item !== host) : [...settings.excludedHosts, host];
  save({ ...settings, excludedHosts });
});
$("restoreSite").addEventListener("click", async () => {
  if (!tab?.id || !host || saving || checking) return;
  saving = true; paint();
  for (const key of settingKeys) $(key).disabled = true;
  $("extended").disabled = true; $("saveUrls").disabled = true; $("reload").disabled = true;
  try {
    const result = await request("RESTORE_SITE", { tabId: tab.id, expectedUrl: tab.url });
    settings = result.settings;
    notice(result.reloaded ? "Đã tắt tiện ích cho " + host + " và tải lại trang để dùng API gốc. Website vẫn có thể yêu cầu các điều kiện khác." : result.reloadError, result.reloaded ? "success" : "error");
  } catch (error) { notice(error.message, "error"); }
  finally {
    saving = false;
    for (const key of settingKeys) $(key).disabled = false;
    $("extended").disabled = false; $("saveUrls").disabled = false; $("reload").disabled = false;
    paint(); await refresh();
  }
});
$("saveUrls").addEventListener("click", () => {
  if (!settings || saving) return;
  const urls = [...new Set($("trackerUrls").value.split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
  const next = normalizeSettings({ ...settings, trackerUrls: urls });
  if (next.trackerUrls.length !== urls.length) return notice("Chỉ nhận tối đa 50 URL HTTP/HTTPS, không có thông tin đăng nhập; dấu * chỉ được đặt ở cuối.", "error");
  save(next);
});
$("refresh").addEventListener("click", refresh);
$("reload").addEventListener("click", async () => {
  if (!tab?.id) return;
  try { await chrome.tabs.reload(tab.id); window.close(); } catch (error) { notice(error.message, "error"); }
});
for (const [id, type] of [["collapse", "COLLAPSE"], ["reset", "RESET"]]) $(id).addEventListener("click", async () => {
  if (!tab?.id) return;
  try { await request(type, { tabId: tab.id }); await refresh(); } catch (error) { notice(error.message, "error"); }
});
$("test").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("demo/index.html") }));
try {
  for (const key of settingKeys) $(key).disabled = true;
  const target = Number(new URL(location.href).searchParams.get("tabId"));
  if (Number.isSafeInteger(target) && target > 0) tab = await chrome.tabs.get(target);
  else [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  readHost();
  settings = (await request("GET_SETTINGS")).settings; paint();
  for (const key of settingKeys) $(key).disabled = false;
  notice("Trạng thái bên trên phản ánh trang đang mở. Thay đổi lớp bảo vệ cần tải lại trang.");
  await refresh();
  setInterval(refresh, 3000);
} catch (error) { notice(error.message, "error"); }
