const $ = id => document.getElementById(id);
if (location.protocol === "chrome-extension:") $("extension-note").hidden = false;
let lastTimer = performance.now(), timerGap = 0, lastFrame = performance.now(), frameGap = 0;
function frame(time) { frameGap = Math.max(frameGap, Math.round(time - lastFrame)); lastFrame = time; requestAnimationFrame(frame); }
requestAnimationFrame(frame);
const fullscreenQuery = matchMedia("(display-mode: fullscreen)");
function update() {
  const now = performance.now(); timerGap = Math.max(timerGap, Math.round(now - lastTimer)); lastTimer = now;
  $("visibility").textContent = document.visibilityState;
  $("hidden").textContent = String(document.hidden);
  $("focus").textContent = String(document.hasFocus());
  $("fullscreen").textContent = document.fullscreenElement?.id || "không";
  $("readings").textContent = JSON.stringify({
    prototypeHidden: Object.getOwnPropertyDescriptor(Document.prototype, "hidden").get.call(document),
    prototypeFocus: Document.prototype.hasFocus.call(document),
    activeElement: document.activeElement?.id || document.activeElement?.tagName,
    fullscreenSelector: document.querySelector(":fullscreen")?.id || null,
    fullscreenMatches: $("stage").matches(":fullscreen"),
    displayModeFullscreen: fullscreenQuery.matches,
    compoundFullscreen: matchMedia("(display-mode: fullscreen) and (min-width: 1px)").matches,
    visibilityHistory: performance.getEntriesByType("visibility-state").map(entry => entry.toJSON()),
    observedVisibility: window.probeVisibilityEntries,
    focusWithin: document.body.matches(":focus-within"),
    wasDiscarded: document.wasDiscarded,
    pointerLock: document.pointerLockElement?.id || null,
    screenIsExtended: screen.isExtended,
    largestTimerGapMs: timerGap,
    largestAnimationFrameGapMs: frameGap
  }, null, 2);
  $("events").textContent = window.probeEvents.map(item => `${item.time} ${item.where}: ${item.type} (${item.target}), trusted=${item.trusted}`).join("\n") || "Chưa nhận sự kiện.";
}
setInterval(update, 300); update();
$("enter").addEventListener("click", () => $("stage").requestFullscreen().catch(error => alert(error.message)));
$("exit").addEventListener("click", () => document.exitFullscreen().catch(error => alert(error.message)));
$("clear").addEventListener("click", () => { window.probeEvents.length = 0; timerGap = 0; frameGap = 0; update(); });
$("native-exit").addEventListener("click", () => alert("Nhấn phím Esc thật hoặc dùng nút Thu fullscreen trong extension."));
for (const id of ["input", "input2"]) for (const type of ["focus", "blur"]) $(id).addEventListener(type, () => {
  $("input-log").textContent = `${id}: ${type} — sự kiện nhập liệu vẫn hoạt động.`;
});
$("new-frame").addEventListener("click", () => {
  const iframe = document.createElement("iframe"); iframe.src = "frame.html"; iframe.title = "Khung kiểm thử động"; $("frames").appendChild(iframe);
});
let demoLock = null;
const result = text => { $("advanced-result").textContent = text; };
$("wake").addEventListener("click", async () => {
  try { demoLock = await navigator.wakeLock.request("screen"); result("Wake Lock: released=" + demoLock.released + ", type=" + demoLock.type); }
  catch (error) { result(error.name + ": " + error.message); }
});
$("release-wake").addEventListener("click", async () => { if (demoLock) { await demoLock.release(); result("Wake Lock: released=" + demoLock.released); } });
$("idle-test").addEventListener("click", async () => {
  try {
    if (!window.IdleDetector) return result("Trình duyệt không có Idle Detection.");
    const permission = await IdleDetector.requestPermission();
    if (permission !== "granted") return result("Idle Detection: " + permission);
    const detector = new IdleDetector(); await detector.start({ threshold: 60000 });
    result("Idle Detection: " + detector.userState + "/" + detector.screenState);
    detector.onchange = () => result("Idle Detection: " + detector.userState + "/" + detector.screenState);
  } catch (error) { result(error.name + ": " + error.message); }
});
$("pointer-test").addEventListener("click", async () => { try { await $("stage").requestPointerLock(); result("Pointer Lock: " + document.pointerLockElement?.id); } catch (error) { result(error.name + ": " + error.message); } });
$("pointer-exit").addEventListener("click", () => { document.exitPointerLock(); result("Đã gọi exitPointerLock."); });
