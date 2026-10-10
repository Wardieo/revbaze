export type PlanId = "free" | "growth" | "pro";
export const planCatalog = {
  free: {
    id: "free",
    name: "Free",
    monthly: 0,
    members: 0,
    businesses: 1,
    cards: 1,
    linksPerCard: 1,
    customQR: false,
    analyticsMonths: 0,
    integrations: false,
    csvImport: false,
    prioritySupport: false,
  },
  growth: {
    id: "growth",
    name: "Growth",
    monthly: 10,
    members: 5,
    businesses: 2,
    cards: 5,
    linksPerCard: null,
    customQR: true,
    analyticsMonths: 12,
    integrations: true,
    csvImport: true,
    prioritySupport: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthly: 29,
    members: 20,
    businesses: null,
    cards: null,
    linksPerCard: null,
    customQR: true,
    analyticsMonths: 24,
    integrations: true,
    csvImport: true,
    prioritySupport: true,
  },
} as const;
export type PlanStatus = {
  plan: PlanId;
  businesses: number;
  cards: number;
  workspace_plan: PlanId;
  workspace_cards: number;
};
export function planFeatures(id: PlanId) {
  const p = planCatalog[id];
  return [
    `${p.businesses ?? "Unlimited"} business${p.businesses === 1 ? "" : "es"}`,
    `${p.cards ?? "Unlimited"} review card${p.cards === 1 ? "" : "s"}`,
    `${p.linksPerCard ?? "Unlimited"} platform link${p.linksPerCard === 1 ? "" : "s"} per card`,
    p.members ? `${p.members} invited members across all businesses · role-based access` : "Owner-only workspace",
    p.customQR ? "Customizable QR codes" : "Basic QR codes",
    ...(p.analyticsMonths
      ? [
          `${p.analyticsMonths}-month analytics history`,
          "Card, platform & campaign comparisons",
          "Cross-business analytics",
          "Analytics CSV exports",
          "Integrations & webhooks",
          "Customer CSV import",
          "Priority support",
        ]
      : []),
  ];
}
