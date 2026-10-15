#!/usr/bin/env node

const baseUrl = (process.env.SFEVENTS_URL ?? "https://sfevents.anishthite.workers.dev").replace(/\/$/, "");
const [command = "list", ...args] = process.argv.slice(2);
const limit = Number(args.find((arg) => arg.startsWith("--limit="))?.slice(8) ?? 20);

if (command === "refresh") {
  if (!process.env.SFEVENTS_SYNC_TOKEN) throw new Error("Set SFEVENTS_SYNC_TOKEN to refresh.");
  const response = await fetch(`${baseUrl}/api/sync`, { method: "POST", headers: { Authorization: `Bearer ${process.env.SFEVENTS_SYNC_TOKEN}` } });
  if (!response.ok) throw new Error(`Sync failed: ${response.status} ${await response.text()}`);
  console.log(JSON.stringify(await response.json(), null, 2));
} else if (command === "list") {
  const response = await fetch(`${baseUrl}/api/events`);
  if (!response.ok) throw new Error(`Event API failed: ${response.status}`);
  const { events } = await response.json();
  for (const event of events.slice(0, limit)) {
    console.log(`${event.start_at ?? "TBD"}\t${event.title}\t${event.location ?? ""}\t${event.source}\t${event.sources}\t${event.source_id}`);
  }
} else {
  throw new Error("Usage: node scripts/sfevents.mjs [list|refresh] [--limit=N]");
}
