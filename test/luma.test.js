import assert from "node:assert/strict";
import test from "node:test";
import { collect, nextRun, retryDelay } from "../scripts/collect-luma.mjs";

test("daily catch-up and bounded retry backoff", () => {
  const now = 1_000_000_000;
  assert.equal(nextRun({ lastSuccess: now - 60_000 }, now), now - 60_000 + 86_400_000);
  assert.equal(nextRun({ lastSuccess: now - 90_000_000 }, now), null);
  assert.equal(retryDelay(1), 900_000);
  assert.equal(retryDelay(20), 21_600_000);
  assert.equal(nextRun({ failures: 1, nextRetry: now + 900_000 }, now), now + 900_000);
  assert.equal(nextRun({ failures: 1, nextRetry: now - 1 }, now), null);
});

test("SF feed pagination keeps unique Luma slugs", async () => {
  const urls = [];
  const events = await collect(async (url) => {
    urls.push(url.toString());
    return { ok: true, json: async () => urls.length === 1
      ? { entries: [{ event: { url: "sf-walk", name: "Walk", start_at: "2026-10-19T12:00:00Z" } }], has_more: true, next_cursor: "next" }
      : { entries: [{ event: { url: "sf-walk", name: "Walk", start_at: "2026-10-19T12:00:00Z" } }], has_more: false } };
  });
  assert.equal(events.length, 1);
  assert.equal(new URL(urls[0]).searchParams.get("discover_place_api_id"), "discplace-BDj7GNbGlsF7Cka");
  assert.equal(new URL(urls[1]).searchParams.get("pagination_cursor"), "next");
});
