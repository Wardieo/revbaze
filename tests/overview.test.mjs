import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
const dir = await mkdtemp(join(tmpdir(), "revbaze-overview-"));
try {
  for (const [source, target] of [
    ["src/lib/analytics.ts", "analytics.mjs"],
    ["src/lib/platforms.ts", "platforms.mjs"],
    ["src/features/overview/activity.ts", "activity.mjs"],
  ]) {
    const code = (await readFile(source, "utf8"))
      .replace('"../../lib/analytics"', '"./analytics.mjs"')
      .replace('"../../lib/platforms"', '"./platforms.mjs"');
    await writeFile(
      join(dir, target),
      ts.transpileModule(code, {
        compilerOptions: { module: ts.ModuleKind.ESNext },
      }).outputText,
    );
  }
  const { workspaceOverview } = await import(
    pathToFileURL(join(dir, "activity.mjs"))
  );
  const workspace = {
    cards: [{ id: "card", name: "Real card", slug: "real", is_active: true }],
    links: [{ id: "link", platform_id: "google" }],
    events: [
      {
        review_card_id: "card",
        event_type: "page_view",
        count: 20,
        created_at: "2026-10-09T00:00:00+08:00",
      },
      {
        review_card_id: "card",
        event_type: "outbound_click",
        count: 5,
        business_review_link_id: "link",
        created_at: "2026-10-09T00:00:00+08:00",
      },
      {
        review_card_id: "card",
        event_type: "page_view",
        count: 10,
        created_at: "2026-10-01T00:00:00+08:00",
      },
      {
        review_card_id: "card",
        event_type: "page_view",
        count: 99,
        created_at: "2026-10-10T00:00:00+08:00",
      },
    ],
  };
  const real = workspaceOverview(
    workspace,
    7,
    new Date("2026-10-09T12:00:00+08:00"),
  );
  assert.deepEqual(real.stats, { views: 20, clicks: 5, ctr: 25 });
  assert.equal(real.previous.views, 10);
  assert.equal(
    real.chart.reduce((n, row) => n + row.views, 0),
    real.stats.views,
  );
  assert.equal(real.cards[0].clicks, real.stats.clicks);
  assert.equal(real.platforms[0].percent, 100);
  assert.equal(real.active, 1);
  assert.equal(
    workspaceOverview({ ...workspace, events: [] }, 30).stats.views,
    0,
  );
  await writeFile(
    join(dir, "mock.mjs"),
    ts.transpileModule(
      await readFile("src/features/overview/mockActivity.ts", "utf8"),
      { compilerOptions: { module: ts.ModuleKind.ESNext } },
    ).outputText,
  );
  const { overviewActivity } = await import(
    pathToFileURL(join(dir, "mock.mjs"))
  );
  await writeFile(
    join(dir, "analytics-mock.mjs"),
    ts.transpileModule(
      (
        await readFile("src/features/analytics/mockActivity.ts", "utf8")
      ).replace('from "../overview/mockActivity"', 'from "./mock.mjs"'),
      { compilerOptions: { module: ts.ModuleKind.ESNext } },
    ).outputText,
  );
  const { analyticsMockActivity } = await import(
    pathToFileURL(join(dir, "analytics-mock.mjs"))
  );
  const mock = analyticsMockActivity(new Date("2026-10-08T12:00:00Z"));
  for (const days of [7, 30, 90]) {
    const rows = mock.events.filter(
      (e) =>
        new Date(e.created_at) >=
        new Date(`2026-10-08T00:00:00+08:00`).getTime() - (days - 1) * 86400000,
    );
    const views = rows
      .filter((e) => e.event_type === "page_view")
      .reduce((n, e) => n + e.count, 0);
    const clicks = rows
      .filter((e) => e.event_type === "outbound_click")
      .reduce((n, e) => n + e.count, 0);
    const expected = overviewActivity(days, new Date("2026-10-08T12:00:00Z"));
    assert.equal(views, expected.stats.views);
    assert.equal(clicks, expected.stats.clicks);
    assert.ok(clicks > 0 && clicks <= views);
    assert.equal(
      mock.links.reduce(
        (total, l) =>
          total +
          rows
            .filter((e) => e.business_review_link_id === l.id)
            .reduce((n, e) => n + e.count, 0),
        0,
      ),
      clicks,
    );
    assert.equal(
      mock.cards.reduce(
        (total, c) =>
          total +
          rows
            .filter(
              (e) => e.review_card_id === c.id && e.event_type === "page_view",
            )
            .reduce((n, e) => n + e.count, 0),
        0,
      ),
      views,
    );
  }
  let last = 0;
  for (const days of [7, 30, 90]) {
    const data = overviewActivity(days, new Date("2026-10-08T12:00:00Z"));
    assert.equal(data.chart.length, days);
    for (const metric of ["views", "clicks"]) {
      assert.equal(
        data.stats[metric],
        data.cards.reduce((n, c) => n + c[metric], 0),
      );
      assert.equal(
        data.stats[metric],
        data.chart.reduce((n, c) => n + c[metric], 0),
      );
    }
    assert.equal(
      data.stats.clicks,
      data.platforms.reduce((n, p) => n + p.clicks, 0),
    );
    assert.equal(data.stats.ctr, (data.stats.clicks / data.stats.views) * 100);
    assert.equal(data.active, data.cards.filter((c) => c.active).length);
    assert.ok(
      Math.abs(data.platforms.reduce((n, p) => n + p.percent, 0) - 100) <
        0.00001,
    );
    assert.ok(data.stats.views > last);
    last = data.stats.views;
    assert.ok(data.chart.every((d) => d.clicks <= d.views));
  }
  console.log(
    "PASS: Overview totals, chart, card rows, platform distribution, CTR, active count, and date ranges agree.",
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
