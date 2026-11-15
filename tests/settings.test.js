import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, normalizeSettings, registrations } from "../src/settings.js";

test("normalize only supported booleans and exact hostnames", () => {
  const settings = normalizeSettings({ enabled: "false", presence: false, excludedHosts: ["EXAMPLE.COM", "example.com", "https://evil.test/", "a*", null] });
  assert.equal(settings.enabled, true);
  assert.equal(settings.presence, false);
  assert.deepEqual(settings.excludedHosts, ["example.com"]);
});
test("registration runs at document_start, main world and matching frames", () => {
  const items = registrations(normalizeSettings({ excludedHosts: ["example.com"] }));
  assert.deepEqual(items.map(item => item.id), ["ps-protection"]);
  assert.equal(items[0].js[0], "build/setup.js");
  assert.equal(items[0].js.at(-1), "build/protection.js");
  assert.ok(items[0].js.includes("build/config-performance-on.js"));
  for (const item of items) {
    assert.equal(item.runAt, "document_start");
    assert.equal(item.world, "MAIN");
    assert.equal(item.allFrames, true);
    assert.equal(item.matchOriginAsFallback, true);
    assert.deepEqual(item.excludeMatches, ["http://example.com/*", "https://example.com/*"]);
  }
  assert.deepEqual(registrations({ ...DEFAULTS, enabled: false }), []);
});
