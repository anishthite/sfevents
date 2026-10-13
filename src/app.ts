import { mergeEvents } from "./events.js";

interface Env {
  DB: D1Database;
  PARTIFUL_MCP: Fetcher;
  CONNECTOR_TOKEN: string;
  SYNC_TOKEN: string;
}

type CandidateGroups = Record<string, unknown[]>;
type EventCard = { source_id: string; title: string; start_at: string | null; location: string | null; image_url: string | null; rsvp_status: string | null; sources: string };

async function sync(env: Env) {
  const response = await env.PARTIFUL_MCP.fetch("https://partiful.internal/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Connector-Token": env.CONNECTOR_TOKEN },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_event_candidates", arguments: {} } }),
  });
  const body = await response.json() as { result?: { structuredContent?: CandidateGroups }; error?: { message: string } };
  const groups = body.result?.structuredContent;
  if (!response.ok || !groups) throw new Error(body.error?.message ?? "Partiful MCP sync failed");

  const now = new Date().toISOString();
  const statements = mergeEvents(groups).map((event) => env.DB.prepare(`
    INSERT INTO events (source, source_id, title, start_at, end_at, timezone, location, image_url, rsvp_status, sources, raw, first_seen_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source, source_id) DO UPDATE SET
      title = excluded.title, start_at = excluded.start_at, end_at = excluded.end_at, timezone = excluded.timezone,
      location = excluded.location, image_url = excluded.image_url, rsvp_status = excluded.rsvp_status,
      sources = excluded.sources, raw = excluded.raw, updated_at = excluded.updated_at
  `).bind("partiful", event.sourceId, event.title, event.startAt, event.endAt, event.timezone, event.location, event.imageUrl, event.rsvpStatus, JSON.stringify(event.sources), JSON.stringify(event.raw), now, now));
  if (statements.length) await env.DB.batch(statements);
  await env.DB.prepare("INSERT INTO sync_runs (source, status, event_count, finished_at) VALUES (?, ?, ?, ?)").bind("partiful", "success", statements.length, now).run();
  return statements.length;
}

async function recordFailure(env: Env, error: unknown) {
  const message = error instanceof Error ? error.message : "Sync failed";
  await env.DB.prepare("INSERT INTO sync_runs (source, status, error, finished_at) VALUES (?, ?, ?, ?)").bind("partiful", "failed", message, new Date().toISOString()).run();
}

function eventCard(event: EventCard, featured = false) {
  const date = event.start_at && event.start_at !== "TBD" ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(event.start_at)) : "Time TBD";
  const sources = JSON.parse(event.sources) as string[];
  return `<a class="event${featured ? " featured" : ""}" href="https://partiful.com/e/${encodeURIComponent(event.source_id)}" target="_blank" rel="noreferrer"><span class="date-mark">${escapeHtml(date.split(",")[0] ?? "TBD")}</span><span class="event-body"><span class="event-title">${escapeHtml(event.title)}</span><span class="event-meta">${escapeHtml(date)}${event.location ? ` · ${escapeHtml(event.location)}` : ""}</span><span class="badges"><span>${sources.includes("discoverable") ? "Discovered" : escapeHtml(sources.join(" · "))}</span>${event.rsvp_status ? `<span>${escapeHtml(event.rsvp_status.toLowerCase())}</span>` : ""}</span></span></a>`;
}

function page(discoveries: EventCard[], events: EventCard[], syncedAt: string | null) {
  const discoveryCards = discoveries.map((event) => eventCard(event, true)).join("") || "<p class=empty>No new discoveries since the last day.</p>";
  const upcomingCards = events.map((event) => eventCard(event)).join("") || "<p class=empty>No upcoming events yet.</p>";
  const syncLabel = syncedAt ? `Last refreshed ${escapeHtml(new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(syncedAt)))}` : "Waiting for first sync";
  return `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>sfevents</title><style>
    :root{color:#191811;background:#f6f5ef;font-family:ui-rounded,"SF Pro Rounded",ui-sans-serif,system-ui,sans-serif}*{box-sizing:border-box}body{margin:0}.shell{max-width:1120px;margin:auto;padding:48px 24px 80px}.top{display:flex;justify-content:space-between;align-items:end;gap:24px;border-bottom:1px solid #d8d5c8;padding-bottom:28px}.eyebrow{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#777367;margin:0 0 8px}h1{font:500 clamp(42px,7vw,72px)/.94 Georgia,serif;letter-spacing:-.065em;margin:0}h2{font:500 28px/1 Georgia,serif;letter-spacing:-.04em;margin:0}.sync{font-size:13px;color:#777367;white-space:nowrap;margin:0}.section{margin-top:44px}.section-head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;margin-bottom:18px}.count{font-size:13px;color:#777367}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.event{background:#fff;border:1px solid #e0ded5;border-radius:14px;color:inherit;display:flex;min-height:168px;overflow:hidden;text-decoration:none;transition:transform 160ms cubic-bezier(.23,1,.32,1),box-shadow 160ms ease}.event:active{transform:scale(.98)}.date-mark{align-items:center;background:#e8e6db;color:#777367;display:flex;font:500 14px/1 Georgia,serif;justify-content:center;min-width:82px;padding:12px;text-align:center}.event-body{display:flex;flex:1;flex-direction:column;gap:8px;padding:16px}.event-title{font-size:16px;font-weight:650;line-height:1.2}.event-meta{font-size:13px;line-height:1.35;color:#68655c}.badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto}.badges span{background:#f0efe8;border-radius:999px;color:#625f55;font-size:11px;padding:4px 7px}.featured{background:#193a2d;color:#f6f5ef;border-color:#193a2d}.featured .event-meta{color:#c8d2c9}.featured .badges span{background:#315342;color:#e6ece4}.empty{color:#777367;font-size:14px;margin:0}@media (hover:hover) and (pointer:fine){.event:hover{box-shadow:0 12px 28px #22221a16;transform:translateY(-2px)}}@media(max-width:760px){.shell{padding:30px 16px 56px}.top{align-items:start;flex-direction:column}.grid{grid-template-columns:1fr}.event{min-height:0}.date-mark{min-width:86px}.event-body{padding:14px}}
  </style><body><main class="shell"><header class="top"><div><p class="eyebrow">San Francisco, from Partiful</p><h1>Things to do.</h1></div><p class="sync">${syncLabel}</p></header><section class="section"><div class="section-head"><h2>New discoveries</h2><span class="count">${discoveries.length} in the last 24 hours</span></div><div class="grid">${discoveryCards}</div></section><section class="section"><div class="section-head"><h2>Upcoming</h2><span class="count">${events.length} events</span></div><div class="grid">${upcomingCards}</div></section></main></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/sync" && request.method === "POST") {
      if (request.headers.get("Authorization") !== `Bearer ${env.SYNC_TOKEN}`) return new Response("Unauthorized", { status: 401 });
      try { return Response.json({ synced: await sync(env) }); } catch (error) { await recordFailure(env, error); return Response.json({ error: error instanceof Error ? error.message : "Sync failed" }, { status: 502 }); }
    }
    if (url.pathname === "/api/events") {
      const { results } = await env.DB.prepare("SELECT source_id, title, start_at, location, image_url, rsvp_status, sources, first_seen_at FROM events WHERE start_at IS NULL OR start_at >= ? ORDER BY start_at LIMIT 100").bind(new Date().toISOString()).all();
      return Response.json({ events: results });
    }
    if (url.pathname === "/") {
      const now = new Date();
      const upcoming = env.DB.prepare("SELECT source_id, title, start_at, location, image_url, rsvp_status, sources FROM events WHERE start_at IS NULL OR start_at >= ? ORDER BY start_at LIMIT 100").bind(now.toISOString());
      const discoveries = env.DB.prepare("SELECT source_id, title, start_at, location, image_url, rsvp_status, sources FROM events WHERE first_seen_at >= ? AND sources LIKE '%\"discoverable\"%' AND (start_at IS NULL OR start_at >= ?) ORDER BY start_at LIMIT 12").bind(new Date(now.getTime() - 86_400_000).toISOString(), now.toISOString());
      const latestSync = env.DB.prepare("SELECT finished_at FROM sync_runs WHERE status = 'success' ORDER BY id DESC LIMIT 1");
      const [eventResults, discoveryResults, syncResult] = await env.DB.batch([upcoming, discoveries, latestSync]);
      const syncedAt = (syncResult.results[0] as { finished_at?: string } | undefined)?.finished_at ?? null;
      return new Response(page(discoveryResults.results as EventCard[], eventResults.results as EventCard[], syncedAt), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
    }
    return new Response("Not found", { status: 404 });
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(sync(env).catch((error) => recordFailure(env, error)));
  },
};
