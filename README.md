# sfevents

Two private Cloudflare Workers:

- `sfevents-partiful` is a remote MCP server that fetches candidate Partiful events.
- `sfevents` runs a daily sync, stores events in D1, and serves `/` and `/api/events`.

The connector uses the same Firebase refresh-token flow as `partiful-mcp`. A browser cookie is not used: Partiful's API calls require a Bearer token, and the refresh token can renew it safely server-side.

## Deploy

```bash
npm install
npx wrangler d1 create sfevents
# Paste the returned database_id into wrangler.app.toml.
npx wrangler d1 execute sfevents --remote --file=schema.sql
npm run deploy:connector
printf '%s' "$PARTIFUL_REFRESH_TOKEN" | npx wrangler secret put PARTIFUL_REFRESH_TOKEN --config wrangler.connector.toml
printf '%s' "$PARTIFUL_FIREBASE_API_KEY" | npx wrangler secret put PARTIFUL_FIREBASE_API_KEY --config wrangler.connector.toml
printf '%s' "$CONNECTOR_TOKEN" | npx wrangler secret put CONNECTOR_TOKEN --config wrangler.connector.toml
printf '%s' "$CONNECTOR_TOKEN" | npx wrangler secret put CONNECTOR_TOKEN --config wrangler.app.toml
printf '%s' "$SYNC_TOKEN" | npx wrangler secret put SYNC_TOKEN --config wrangler.app.toml
npm run deploy:app
```

Get `PARTIFUL_REFRESH_TOKEN` from Partiful's Firebase IndexedDB record as described by the installed `partiful-mcp` integration. It is a Cloudflare secret, never a source file or browser value.

The app Worker reaches the connector over the `PARTIFUL_MCP` Service Binding; a shared `CONNECTOR_TOKEN` also rejects direct requests to its public Worker URL. Trigger a first sync with:

```bash
curl -H "Authorization: Bearer $SYNC_TOKEN" -X POST https://sfevents.<your-subdomain>.workers.dev/api/sync
```

The scheduled cron sync runs daily at 16:00 UTC.

## Local SF Luma collector

Luma's Discover feed is IP-geolocated and returned empty from the Worker. The Mac collector uses the hardcoded San Francisco place ID, paginates the public API, and uploads events through `POST /api/luma/ingest` using the existing `SYNC_TOKEN`. It needs no Luma API key or browser session.

```bash
node scripts/collect-luma.mjs     # one-off run; reads ignored .sync-token (or SFEVENTS_SYNC_TOKEN)
zsh scripts/install-luma-launchd.sh # check every 15 minutes; run on login
```

The job checks every 15 minutes while awake and on login. A missed run catches up after wake/login; successful runs are at least 24 hours apart. Failures retry with exponential backoff from 15 minutes up to 6 hours. State lives in `~/Library/Application Support/sfevents/luma-sync.json`; logs live in `~/Library/Logs/sfevents-luma.{log,err.log}`. Never commit `.sync-token`.

## REST API

```text
GET  /api/events?limit=100
GET  /api/recommendations?limit=10
POST /api/sync                 # Authorization: Bearer $SFEVENTS_SYNC_TOKEN
```

`/api/recommendations` returns events ranked for meeting people, with transparent scores, reasons, and outbound URLs.

## Agent CLI and skill

Give another agent <code>skills/sfevents/SKILL.md</code>. It uses the deployed event feed instead of creating a second scraper.

```bash
npm run events -- list --limit=20
SFEVENTS_SYNC_TOKEN=... npm run events -- refresh
```

## Check

```bash
npm run check
```
