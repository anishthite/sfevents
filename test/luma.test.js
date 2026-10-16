import assert from "node:assert/strict";
import test from "node:test";
import { collect } from "../scripts/collect-luma.mjs";

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
