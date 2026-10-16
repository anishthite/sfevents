#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const base = "https://api.lu.ma/discover/get-paginated-events";
const placeId = "discplace-BDj7GNbGlsF7Cka"; // San Francisco
const destination = process.env.SFEVENTS_URL ?? "https://sfevents.anishthite.workers.dev";

export async function collect(fetcher = fetch) {
  const events = new Map();
  let cursor;
  for (let page = 0; page < 10; page++) {
    const url = new URL(base);
    url.searchParams.set("discover_place_api_id", placeId);
    url.searchParams.set("pagination_limit", "50");
    if (cursor) url.searchParams.set("pagination_cursor", cursor);
    const response = await fetcher(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Luma API: HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.entries)) throw new Error("Luma API returned no entries array");
    for (const { event } of data.entries) {
      if (!event?.url || !event?.name || !event?.start_at) continue;
      events.set(event.url, { id: event.url, title: event.name, startDate: event.start_at, endDate: event.end_at, timezone: event.timezone, locationDisplayText: event.geo_address_info?.city_state ?? event.geo_address_info?.city ?? null });
    }
    if (!data.has_more || !data.next_cursor) break;
    cursor = data.next_cursor;
  }
  if (!events.size) throw new Error("Luma returned zero SF events; refusing to ingest an empty feed");
  return [...events.values()];
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const token = process.env.SFEVENTS_SYNC_TOKEN ?? (await readFile(new URL("../.sync-token", import.meta.url), "utf8")).trim();
  const events = await collect();
  for (let i = 0; i < events.length; i += 100) {
    const response = await fetch(`${destination}/api/luma/ingest`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(events.slice(i, i + 100)) });
    if (!response.ok) throw new Error(`Ingest failed: HTTP ${response.status} ${await response.text()}`);
  }
  console.log(`Ingested ${events.length} SF Luma events`);
}
