import type { CardEvent } from "../types/workspace";
export function metrics(events: CardEvent[]) {
  const views = events
    .filter((e) => e.event_type === "page_view")
    .reduce((n, e) => n + (e.count ?? 1), 0);
  const clicks = events
    .filter((e) => e.event_type === "outbound_click")
    .reduce((n, e) => n + (e.count ?? 1), 0);
  return { views, clicks, ctr: views ? (clicks / views) * 100 : 0 };
}
export function analyticsDay(value: string | Date, timeZone = "Asia/Manila") {
  return new Date(value).toLocaleDateString("en-CA", {
    timeZone,
  });
}
export function filterEvents(
  events: CardEvent[],
  {
    days = "30",
    from = "",
    to = "",
    card = "",
    platform = "",
    links = [],
    timeZone = "Asia/Manila",
  }: {
    timeZone?: string;
    days?: string;
    from?: string;
    to?: string;
    card?: string;
    platform?: string;
    links?: { id: string; platform_id: string }[];
  },
) {
  const endDay = to || analyticsDay(new Date(), timeZone);
  const startDate = new Date(`${endDay}T12:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - Number(days) + 1);
  const startDay = from || startDate.toISOString().slice(0, 10);
  return events.filter(
    (e) =>
      analyticsDay(e.created_at, timeZone) >= startDay &&
      analyticsDay(e.created_at, timeZone) <= endDay &&
      (!card || e.review_card_id === card) &&
      (!platform ||
        e.event_type === "page_view" ||
        (e.platform_id
          ? e.platform_id === platform
          : links.some(
              (l) =>
                l.id === e.business_review_link_id &&
                l.platform_id === platform,
            ))),
  );
}
export function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}

/** Previous calendar range of equal length, using the dashboard's reporting timezone. */
export function previousAnalyticsRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00+08:00`);
  const end = new Date(`${to}T00:00:00+08:00`);
  const length = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (!Number.isFinite(length) || length < 1) return null;
  const previousEnd = new Date(start.getTime() - 86400000);
  const previousStart = new Date(
    previousEnd.getTime() - (length - 1) * 86400000,
  );
  return { from: analyticsDay(previousStart), to: analyticsDay(previousEnd) };
}

export function uniqueBrowsers(events: CardEvent[]) {
  return new Set(
    events
      .filter((e) => e.event_type === "page_view" && e.visitor_key)
      .map((e) => e.visitor_key),
  ).size;
}
