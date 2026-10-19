#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const base = "https://api.lu.ma/discover/get-paginated-events";
const placeId = "discplace-BDj7GNbGlsF7Cka"; // San Francisco
const destination = process.env.SFEVENTS_URL ?? "https://sfevents.anishthite.workers.dev";
const statePath = join(homedir(), "Library/Application Support/sfevents/luma-sync.json");
const day = 24 * 60 * 60 * 1000;
const quarterHour = 15 * 60 * 1000;

export function nextRun(state, now = Date.now()) {
  if (state.nextRetry && now < state.nextRetry) return state.nextRetry;
  if (!state.failures && state.lastSuccess && now < state.lastSuccess + day) return state.lastSuccess + day;
  return null;
}

export function retryDelay(failures) {
  return Math.min(quarterHour * 2 ** Math.min(failures - 1, 5), 6 * 60 * 60 * 1000);
}

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
  let state;
  try { state = JSON.parse(await readFile(statePath, "utf8")); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    state = {};
  }
  const waitUntil = nextRun(state);
  if (waitUntil) {
    console.log(`Luma sync current; next attempt ${new Date(waitUntil).toISOString()}`);
  } else {
    try {
      const token = process.env.SFEVENTS_SYNC_TOKEN ?? (await readFile(new URL("../.sync-token", import.meta.url), "utf8")).trim();
      const events = await collect();
      for (let i = 0; i < events.length; i += 100) {
        const response = await fetch(`${destination}/api/luma/ingest`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(events.slice(i, i + 100)) });
        if (!response.ok) throw new Error(`Ingest failed: HTTP ${response.status} ${await response.text()}`);
      }
      state = { lastSuccess: Date.now(), failures: 0 };
      console.log(`Ingested ${events.length} SF Luma events`);
    } catch (error) {
      const failures = (state.failures ?? 0) + 1;
      state = { ...state, failures, nextRetry: Date.now() + retryDelay(failures) };
      console.error(error);
      process.exitCode = 1;
    }
    await mkdir(join(homedir(), "Library/Application Support/sfevents"), { recursive: true });
    await writeFile(statePath, JSON.stringify(state), { mode: 0o600 });
  }
}
