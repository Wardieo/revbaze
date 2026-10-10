import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import QRCode from "qrcode";
const dir = await mkdtemp(join(tmpdir(), "revbaze-domain-tests-"));
try {
  for (const name of [
    "platforms",
    "validation",
    "analytics",
    "colors",
    "images",
    "qr",
  ]) {
    let source = await readFile(`src/lib/${name}.ts`, "utf8");
    source = source
      .replace('from "./platforms"', 'from "./platforms.mjs"')
      .replaceAll("import.meta.env", "({})")
      .replace('from "./colors"', 'from "./colors.mjs"')
      .replace(
        'from "qrcode"',
        `from "${pathToFileURL(join(process.cwd(), "node_modules/qrcode/lib/index.js"))}"`,
      );
    await writeFile(
      join(dir, `${name}.mjs`),
      ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2023,
          module: ts.ModuleKind.ESNext,
        },
      }).outputText,
    );
  }
  const { qrSvg } = await import(pathToFileURL(join(dir, "qr.mjs")));
  const qrUrl = "https://revbaze.example/#/review/cedar-studio";
  const symbol = QRCode.create(qrUrl, { errorCorrectionLevel: "H" });
  const dark = Array.from(symbol.modules.data).filter(Boolean).length;
  for (const style of ["square", "rounded", "dots"]) {
    const svg = qrSvg(qrUrl, "#253147", "#ffffff", style);
    assert.ok(
      svg.includes(
        `viewBox="0 0 ${symbol.modules.size + 8} ${symbol.modules.size + 8}"`,
      ),
    );
    assert.equal(
      (svg.match(/<rect /g) || []).length +
        (svg.match(/<circle /g) || []).length -
        1,
      dark,
    );
    if (style === "dots") assert.ok(svg.includes("<circle"));
    if (style === "rounded") assert.ok(svg.includes('rx="0.22"'));
  }
  assert.throws(() => qrSvg(qrUrl, "#ffffff", "#ffffff", "dots"));
  const { validateImage, IMAGE_SIZE_LIMIT } = await import(
    pathToFileURL(join(dir, "images.mjs"))
  );
  for (const [name, type] of [
    ["logo.PNG", "image/png"],
    ["logo.jpg", "image/jpeg"],
    ["logo.jpeg", "image/jpeg"],
  ]) {
    validateImage({ name, type, size: IMAGE_SIZE_LIMIT - 1 });
    assert.throws(() => validateImage({ name, type, size: IMAGE_SIZE_LIMIT }));
  }
  for (const file of [
    { name: "logo.webp", type: "image/webp", size: 100 },
    { name: "logo.svg", type: "image/png", size: 100 },
    { name: "logo.png", type: "image/jpeg", size: 100 },
    { name: "logo.png", type: "image/png", size: 0 },
  ])
    assert.throws(() => validateImage(file));
  const { validateDestination, validateSlug, cardUrl } = await import(
    pathToFileURL(join(dir, "validation.mjs"))
  );
  const {
    metrics,
    filterEvents,
    analyticsDay,
    previousAnalyticsRange,
    uniqueBrowsers,
  } = await import(pathToFileURL(join(dir, "analytics.mjs")));
  const { validateQRColors } = await import(
    pathToFileURL(join(dir, "colors.mjs"))
  );
  assert.equal(
    validateDestination("https://g.page/r/acme/review", "google"),
    "https://g.page/r/acme/review",
  );
  assert.equal(
    validateDestination("https://reviews.acme.com/feedback", "custom"),
    "https://reviews.acme.com/feedback",
  );
  for (const url of [
    "http://google.com",
    "javascript:alert(1)",
    "data:text/html,test",
    "https://google.com.evil.com",
    "https://google.com@evil.com",
    "https://google.com:8080",
    "https://google.com/url?url=https://evil.com",
    "https://127.0.0.1",
    "https://[::1]",
    "https://reviews.local",
    "https://google.com\\@evil.com",
    " https://google.com",
    "https://google.com\n",
  ])
    assert.throws(() => validateDestination(url, "google"), undefined, url);
  for (const slug of [
    "ab",
    "UPPERCASE",
    "-acme",
    "acme-",
    "acme studio",
    "admin",
    "a".repeat(61),
  ])
    assert.throws(() => validateSlug(slug));
  assert.equal(
    cardUrl("acme-studio"),
    "https://revbaze.com/#/review/acme-studio",
  );
  const publicOriginSource = (await readFile(join(dir, "validation.mjs"), "utf8"))
    .replaceAll("({})", '({ DEV: true, VITE_PUBLIC_CARD_ORIGIN: "https://revbaze.vercel.app/" })');
  await writeFile(join(dir, "validation-public-origin.mjs"), publicOriginSource);
  const publicOriginLinks = await import(pathToFileURL(join(dir, "validation-public-origin.mjs")));
  assert.equal(publicOriginLinks.cardUrl("acme-studio"), "https://revbaze.vercel.app/#/review/acme-studio");
  assert.equal(publicOriginLinks.cardQRUrl("acme-studio"), "https://revbaze.vercel.app/#/review/acme-studio?utm_source=qr");
  assert.deepEqual(previousAnalyticsRange("2026-10-01", "2026-10-07"), {
    from: "2026-09-24",
    to: "2026-09-30",
  });
  assert.deepEqual(previousAnalyticsRange("2026-01-01", "2026-01-01"), {
    from: "2025-12-31",
    to: "2025-12-31",
  });
  assert.equal(previousAnalyticsRange("", ""), null);
  assert.equal(previousAnalyticsRange("2026-10-07", "2026-10-01"), null);
  assert.equal(
    uniqueBrowsers([
      { event_type: "page_view", visitor_key: "a" },
      { event_type: "page_view", visitor_key: "a" },
      { event_type: "page_view", visitor_key: "b" },
      { event_type: "outbound_click", visitor_key: "c" },
      { event_type: "page_view", visitor_key: null },
    ]),
    2,
  );
  assert.equal(
    analyticsDay("2026-03-08T07:30:00Z", "America/Los_Angeles"),
    "2026-03-07",
  );
  assert.equal(analyticsDay("2026-03-08T07:30:00Z", "UTC"), "2026-03-08");
  const boundaryEvents = [
    { event_type: "page_view", created_at: "2026-03-08T07:30:00Z" },
    { event_type: "page_view", created_at: "2026-03-09T06:30:00Z" },
  ];
  assert.equal(
    filterEvents(boundaryEvents, {
      from: "2026-03-08",
      to: "2026-03-08",
      timeZone: "America/Los_Angeles",
    }).length,
    1,
  );
  assert.equal(
    filterEvents(boundaryEvents, {
      from: "2026-03-08",
      to: "2026-03-08",
      timeZone: "UTC",
    }).length,
    1,
  );
  assert.deepEqual(metrics([]), { views: 0, clicks: 0, ctr: 0 });
  const events = [
    {
      id: "1",
      review_card_id: "a",
      event_type: "page_view",
      count: 20,
      created_at: "2026-10-08T06:00:00Z",
      business_review_link_id: null,
    },
    {
      id: "2",
      review_card_id: "a",
      event_type: "outbound_click",
      count: 5,
      created_at: "2026-10-08T06:00:00Z",
      business_review_link_id: "google",
    },
    {
      id: "3",
      review_card_id: "a",
      event_type: "outbound_click",
      count: 2,
      created_at: "2026-10-08T06:00:00Z",
      business_review_link_id: "trustpilot",
    },
    {
      id: "4",
      review_card_id: "b",
      event_type: "page_view",
      count: 10,
      created_at: "2026-10-07T06:00:00Z",
      business_review_link_id: null,
    },
  ];
  assert.deepEqual(metrics(events), {
    views: 30,
    clicks: 7,
    ctr: (7 / 30) * 100,
  });
  const selected = filterEvents(events, {
    from: "2026-10-08",
    to: "2026-10-08",
    card: "a",
    platform: "google",
    links: [{ id: "google", platform_id: "google" }],
  });
  assert.deepEqual(
    metrics(selected),
    { views: 20, clicks: 5, ctr: 25 },
    "platform CTR preserves page-view denominator",
  );
  assert.doesNotThrow(() => validateQRColors("#253147", "#ffffff"));
  assert.throws(() => validateQRColors("#ffffff", "#ffffff"));
  assert.throws(() => validateQRColors("#eeeeee", "#ffffff"));
  console.log(
    "PASS: client destination validation, slug rules, future share URL, zero-data metrics, aggregated counts, date/card/platform filters, CTR, and QR contrast.",
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
