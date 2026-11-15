import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, FEATURE_KEYS, featureSignature, normalizeSettings } from "../src/settings.js";
import { VERSION } from "../src/protocol.js";
import { applicationStatus } from "../src/status.js";
const settings = normalizeSettings();
const installed = { frameId: 0, result: { installed: true, version: VERSION, signature: featureSignature(settings), features: Object.fromEntries(FEATURE_KEYS.filter(key => settings[key]).map(key => [key, true])), failures: [] } };
test("status distinguishes configured, installed, partial and stale documents", () => {
  assert.equal(applicationStatus(settings, [], "https://example.test").state, "missing");
  assert.equal(applicationStatus(settings, [installed], "https://example.test").state, "applied");
  assert.equal(applicationStatus(settings, [installed, { frameId: 2, result: { installed: false } }], "https://example.test").state, "partial");
  assert.equal(applicationStatus(settings, [{ ...installed, result: { ...installed.result, failures: ["hidden"] } }], "https://example.test").state, "partial");
  assert.equal(applicationStatus(settings, [{ ...installed, result: { ...installed.result, version: "1.0.0" } }], "https://example.test").state, "reload");
  assert.equal(applicationStatus({ ...settings, idle: false }, [installed], "https://example.test").state, "reload");
});
test("disable/exclusion cannot claim old patches were already removed", () => {
  const disabled = { ...settings, enabled: false };
  assert.equal(applicationStatus(disabled, [installed], "https://example.test").state, "reload");
  assert.equal(applicationStatus(disabled, [], "https://example.test").state, "disabled");
  const excluded = { ...settings, excludedHosts: ["example.test"] };
  assert.equal(applicationStatus(excluded, [{ frameId: 0, result: { installed: false } }], "https://example.test").state, "disabled");
  assert.equal(applicationStatus(settings, [], "chrome://extensions").state, "restricted");
  assert.equal(applicationStatus(settings, [], "https://example.test", "permission denied").state, "unknown");
});
test("site exclusion verifies the top document without a cross-origin reload loop", () => {
  const excluded = { ...settings, excludedHosts: ["example.test"] };
  const nativeTop = { frameId: 0, result: { installed: false } };
  const protectedChild = { ...installed, frameId: 2 };
  const state = applicationStatus(excluded, [nativeTop, protectedChild], "https://example.test");
  assert.equal(state.state, "disabled");
  assert.match(state.description, /Khung khác nguồn/);
  assert.equal(applicationStatus(excluded, [installed], "https://example.test").state, "reload");
  assert.equal(applicationStatus(excluded, [], "https://example.test").state, "unknown");
  assert.equal(applicationStatus(excluded, [nativeTop], "https://example.test", "permission denied").state, "unknown");
});
test("tracker URL validation preserves literal prefixes and rejects credentials/wildcards in host", () => {
  const value = normalizeSettings({ trackerUrls: ["https://track.test/e*", "https://track.test/e*", "https://u:p@track.test/e", "https://*.test/*", "javascript:alert(1)", "https://track.test/e#x"] });
  assert.deepEqual(value.trackerUrls, ["https://track.test/e*"]);
  assert.equal(DEFAULTS.capture, false);
});
