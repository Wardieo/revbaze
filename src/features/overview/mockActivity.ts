export const demoCards = [
  {
    id: "main",
    name: "The everyday invitation",
    slug: "studio-north",
    active: true,
    channel: "Main review link",
    weight: 1,
  },
  {
    id: "counter",
    name: "At the front desk",
    slug: "studio-north-counter",
    active: true,
    channel: "Printed QR code",
    weight: 0.64,
  },
  {
    id: "followup",
    name: "A little thank you",
    slug: "studio-north-thanks",
    active: true,
    channel: "Follow-up email",
    weight: 0.47,
  },
  {
    id: "social",
    name: "From our community",
    slug: "studio-north-social",
    active: true,
    channel: "Social bio",
    weight: 0.28,
  },
  {
    id: "summer",
    name: "Summer at the studio",
    slug: "studio-north-summer",
    active: false,
    channel: "Seasonal campaign",
    weight: 0.19,
  },
];
export const demoPlatforms = [
  { id: "google", name: "Google Reviews", share: 0.49, color: "#4b7fe7" },
  { id: "trustpilot", name: "Trustpilot", share: 0.24, color: "#67b096" },
  { id: "facebook", name: "Facebook", share: 0.17, color: "#8f9eea" },
  { id: "yelp", name: "Yelp", share: 0.1, color: "#e5aa7b" },
];
export const demoLink = "https://revbaze.com/r/studio-north";
// Deterministic daily activity: every statistic is summed from these same rows.
export function overviewActivity(days: number, now = new Date()) {
  const rows = Array.from({ length: 180 }, (_, age) => {
    const date = new Date(now);
    date.setDate(date.getDate() - age);
    date.setHours(12, 0, 0, 0);
    const cards = demoCards.map((card, index) => {
      const views =
        !card.active && age < 12
          ? 0
          : Math.round(
              (38 +
                (180 - age) * 0.37 +
                ((age * 17 + index * 11) % 29) +
                (date.getDay() === 6 ? 22 : 0)) *
                card.weight,
            );
      const clicks = Math.round(
        views * (0.31 + ((age + index * 3) % 9) * 0.014),
      );
      const platformClicks = demoPlatforms.map((p) =>
        Math.floor(clicks * p.share),
      );
      platformClicks[0] +=
        clicks - platformClicks.reduce((sum, n) => sum + n, 0);
      return { id: card.id, views, clicks, platformClicks };
    });
    return {
      age,
      date: date.toISOString(),
      cards,
      views: cards.reduce((s, c) => s + c.views, 0),
      clicks: cards.reduce((s, c) => s + c.clicks, 0),
    };
  });
  const selected = rows.filter((r) => r.age < days);
  const previous = rows.filter((r) => r.age >= days && r.age < days * 2);
  const total = (data: typeof rows) => {
    const views = data.reduce((s, r) => s + r.views, 0),
      clicks = data.reduce((s, r) => s + r.clicks, 0);
    return { views, clicks, ctr: views ? (clicks / views) * 100 : 0 };
  };
  const stats = total(selected);
  return {
    stats,
    previous: total(previous),
    chart: selected
      .slice()
      .reverse()
      .map((r) => ({ date: r.date, views: r.views, clicks: r.clicks })),
    cards: demoCards.map((c) => {
      const views = selected.reduce(
          (s, r) => s + r.cards.find((x) => x.id === c.id)!.views,
          0,
        ),
        clicks = selected.reduce(
          (s, r) => s + r.cards.find((x) => x.id === c.id)!.clicks,
          0,
        );
      return { ...c, views, clicks, ctr: views ? (clicks / views) * 100 : 0 };
    }),
    platforms: demoPlatforms.map((p, i) => {
      const clicks = selected.reduce(
        (s, r) => s + r.cards.reduce((n, c) => n + c.platformClicks[i], 0),
        0,
      );
      return {
        ...p,
        clicks,
        percent: stats.clicks ? (clicks / stats.clicks) * 100 : 0,
      };
    }),
    active: demoCards.filter((c) => c.active).length,
  };
}
