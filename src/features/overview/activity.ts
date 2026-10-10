import { analyticsDay, metrics } from "../../lib/analytics";
import { platforms } from "../../lib/platforms";
import type { WorkspaceData } from "../../types/workspace";

export function workspaceOverview(
  workspace: WorkspaceData,
  days: number,
  now = new Date(),
) {
  const end = new Date(`${analyticsDay(now)}T00:00:00+08:00`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const previousStart = new Date(start);
  previousStart.setUTCDate(previousStart.getUTCDate() - days);
  const selected = workspace.events.filter(
    (e) => new Date(e.created_at) >= start && new Date(e.created_at) <= now,
  );
  const previous = workspace.events.filter(
    (e) =>
      new Date(e.created_at) >= previousStart && new Date(e.created_at) < start,
  );
  const stats = metrics(selected);
  const chart = Array.from({ length: days }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + index);
    const date = analyticsDay(day);
    return {
      date: day.toISOString(),
      ...metrics(selected.filter((e) => analyticsDay(e.created_at) === date)),
    };
  });
  const distribution = new Map<string, number>();
  selected
    .filter((e) => e.event_type === "outbound_click")
    .forEach((e) => {
      const link = workspace.links.find(
        (l) => l.id === e.business_review_link_id,
      );
      const id = e.platform_id || link?.platform_id || "custom";
      distribution.set(id, (distribution.get(id) || 0) + (e.count ?? 1));
    });
  return {
    stats,
    previous: metrics(previous),
    chart,
    active: workspace.cards.filter((c) => c.is_active).length,
    cards: workspace.cards.map((c) => ({
      id: c.id,
      name: c.name,
      channel: c.slug,
      active: c.is_active,
      ...metrics(selected.filter((e) => e.review_card_id === c.id)),
    })),
    platforms: [...distribution]
      .map(([id, clicks]) => ({
        id,
        name: platforms.find((p) => p.id === id)?.name || "Other platforms",
        color: platforms.find((p) => p.id === id)?.color || "#64748b",
        clicks,
        percent: stats.clicks ? (clicks / stats.clicks) * 100 : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks),
  };
}
