import {
  demoCards,
  demoPlatforms,
  overviewActivity,
} from "../overview/mockActivity";
import type { CardEvent } from "../../types/workspace";
function distribute(total: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const values = weights.map((weight) => Math.floor((total * weight) / sum));
  values[0] += total - values.reduce((a, b) => a + b, 0);
  return values;
}
export function analyticsMockActivity(now = new Date()) {
  const cards = demoCards.map((c) => ({ id: c.id, name: c.name }));
  const links = demoPlatforms.map((p) => ({
    id: `demo-${p.id}`,
    platform_id: p.id,
  }));
  const events: CardEvent[] = [];
  const sources = [
    "Direct / QR code",
    "google.com",
    "instagram.com",
    "Email campaign",
  ];
  for (const [day, row] of overviewActivity(90, now).chart.entries()) {
    const views = distribute(
      row.views,
      demoCards.map((c) => c.weight),
    );
    const clicks = distribute(
      row.clicks,
      demoCards.map((c) => c.weight),
    );
    for (const [i, c] of cards.entries()) {
      events.push({
        id: `view-${day}-${c.id}`,
        review_card_id: c.id,
        event_type: "page_view",
        business_review_link_id: null,
        referrer: sources[(day + i) % sources.length],
        created_at: row.date,
        count: views[i],
      });
      const platformClicks = distribute(
        clicks[i],
        demoPlatforms.map((p) => p.share),
      );
      links.forEach((l, j) =>
        events.push({
          id: `click-${day}-${c.id}-${j}`,
          review_card_id: c.id,
          event_type: "outbound_click",
          business_review_link_id: l.id,
          referrer: null,
          created_at: row.date,
          count: platformClicks[j],
        }),
      );
    }
  }
  return { cards, links, events };
}
