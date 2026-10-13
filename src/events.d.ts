export interface NormalizedEvent {
  source: string;
  sourceId: string;
  title: string;
  startAt: string | null;
  endAt: string | null;
  timezone: string | null;
  location: string | null;
  imageUrl: string | null;
  rsvpStatus: string | null;
  sources: string[];
  raw: unknown;
}

export function normalizeEvent(event: Record<string, unknown>, source: string): NormalizedEvent;
export function mergeEvents(groups: Record<string, unknown[]>): NormalizedEvent[];
