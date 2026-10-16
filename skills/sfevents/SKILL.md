---
name: sfevents
description: Find and recommend upcoming San Francisco Bay Area events from the deployed sfevents dashboard. Use when asked what events to attend, date ideas, social activities, a fresh event shortlist, or to refresh the event feed.
---

# SF Events

Use the deployed REST API as the source of truth; do not scrape Partiful, Luma, or 19hz independently.

```bash
curl 'https://sfevents.anishthite.workers.dev/api/recommendations?limit=10'
node scripts/sfevents.mjs list --limit=50
```

## Workflow

1. Run `list` first; use its upcoming event data.
2. Give a short ranked shortlist relevant to the user’s stated goal.
3. State why each event fits using only title, time, location, and source metadata; do not infer attendee demographics.
4. Link Partiful events as `https://partiful.com/e/<source_id>` when that ID is available; otherwise direct the user to the dashboard.
5. Refresh only when explicitly asked or when the listing is stale:

```bash
SFEVENTS_SYNC_TOKEN=... node scripts/sfevents.mjs refresh
```

`SFEVENTS_SYNC_TOKEN` is a secret. Never print it, save it, commit it, or place it in browser code.

## Default recommendation lens

For dating, prefer explicit singles/dating/mixer signals, then solo-friendly social activities, classes, walks, games, and dance events. Do not claim an event will have a particular gender balance or infer people’s identities from names or photos.
