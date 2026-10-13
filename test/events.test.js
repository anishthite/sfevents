import assert from "node:assert/strict";
import test from "node:test";
import { mergeEvents } from "../src/events.js";

test("mergeEvents keeps one event and records every Partiful list that supplied it", () => {
  const [event] = mergeEvents({ discoverable: [{ id: "1", title: "Party", startDate: "2026-10-11T20:00:00Z" }], saved: [{ id: "1", title: "Party" }] });
  assert.equal(event.sourceId, "1");
  assert.deepEqual(event.sources, ["discoverable", "saved"]);
});
