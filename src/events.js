export function normalizeEvent(event, source) {
  const location = event.locationDisplayText ?? event.location?.name ?? event.location?.address ?? null;
  return {
    source,
    sourceId: String(event.id),
    title: event.title ?? "Untitled event",
    startAt: event.startDate ?? null,
    endAt: event.endDate ?? null,
    timezone: event.timezone ?? null,
    location,
    imageUrl: event.image?.url ?? null,
    rsvpStatus: event.guest?.status ?? null,
    sources: [source],
    raw: event,
  };
}

export function mergeEvents(groups) {
  const events = new Map();
  for (const [source, items] of Object.entries(groups)) {
    for (const item of items) {
      if (!item?.id) continue;
      const event = normalizeEvent(item, source);
      const existing = events.get(event.sourceId);
      if (existing) existing.sources.push(source);
      else events.set(event.sourceId, event);
    }
  }
  return [...events.values()];
}