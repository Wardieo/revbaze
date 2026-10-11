import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
`);
await db.exec(
  await readFile(
    "supabase/migrations/202610080001_review_link_management.sql",
    "utf8",
  ),
);
await db.exec(
  await readFile(
    "supabase/migrations/202610080002_onboarding_publication.sql",
    "utf8",
  ),
);
await db.exec(
  await readFile(
    "supabase/migrations/202610080003_onboarding_templates_assets.sql",
    "utf8",
  ),
);
await db.exec(
  await readFile(
    "supabase/migrations/202610100021_onboarding_card_background.sql",
    "utf8",
  ),
);
await db.exec(
  await readFile(
    "supabase/migrations/202610100022_onboarding_card_border.sql",
    "utf8",
  ),
);
await db.exec(
  await readFile(
    "supabase/migrations/202610100023_card_background_styles.sql",
    "utf8",
  ),
);
await db.exec(
  await readFile(
    "supabase/migrations/202610100024_card_page_background.sql",
    "utf8",
  ),
);
await db.exec(
  await readFile(
    "supabase/migrations/202610100025_abstract_page_background.sql",
    "utf8",
  ),
);
await db.exec(
  await readFile(
    "supabase/migrations/202610100026_card_text_colors.sql",
    "utf8",
  ),
);
await db.exec(
  await readFile(
    "supabase/migrations/202610110027_category_review_platforms.sql",
    "utf8",
  ),
);
await db.exec(
  await readFile(
    "supabase/migrations/202610110028_shopify_review_platform.sql",
    "utf8",
  ),
);
for (const [id, url] of [
  ["amazon", "https://www.amazon.com/sp?seller=123"],
  ["etsy", "https://www.etsy.com/shop/example"],
  ["shopify", "https://example.myshopify.com/products/example"],
  ["healthgrades", "https://www.healthgrades.com/physician/example"],
  ["clutch", "https://clutch.co/profile/example"],
  ["booking", "https://www.booking.com/hotel/example.html"],
  ["opentable", "https://www.opentable.com/r/example"],
  ["fresha", "https://www.fresha.com/a/example"],
  ["course-report", "https://www.coursereport.com/schools/example"],
  ["houzz", "https://www.houzz.com/pro/example"],
  ["viator", "https://www.viator.com/tours/example"],
]) {
  assert.equal(
    (
      await db.query("select public.valid_review_url($1,$2) as valid", [
        id,
        url,
      ])
    ).rows[0].valid,
    true,
  );
  assert.equal(
    (
      await db.query("select public.valid_review_url($1,$2) as valid", [
        id,
        "https://unrelated.example.com",
      ])
    ).rows[0].valid,
    false,
  );
}
const buckets = (
  await db.query(
    "select * from storage.buckets where id in ('profile-assets','business-assets')",
  )
).rows;
assert.equal(buckets.length, 2);
for (const bucket of buckets) {
  assert.equal(Number(bucket.file_size_limit), 10485759);
  assert.deepEqual(bucket.allowed_mime_types, ["image/png", "image/jpeg"]);
}
const alice = "00000000-0000-4000-8000-000000000001",
  bob = "00000000-0000-4000-8000-000000000002",
  viewer = "00000000-0000-4000-8000-000000000003";
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002";
const linkA = "20000000-0000-4000-8000-000000000001",
  linkB = "20000000-0000-4000-8000-000000000002",
  cardId = "30000000-0000-4000-8000-000000000001";
await db.query("insert into auth.users(id) values($1),($2),($3)", [
  alice,
  bob,
  viewer,
]);
async function login(id) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
const business = (id, name) => ({
  id,
  name,
  slug: name.toLowerCase(),
  brand_color: "#4b7fe7",
  logo_url: "",
  website_url: "https://example.com",
  description: "",
  category: "Software",
  contact_email: "",
});
await login(alice);
await db.query("select public.save_business($1::jsonb)", [
  JSON.stringify(business(a, "Acme")),
]);
await login(bob);
await db.query("select public.save_business($1::jsonb)", [
  JSON.stringify(business(b, "Studio")),
]);
assert.equal(
  (await db.query("select id from public.businesses")).rows.length,
  1,
);
assert.equal(
  (await db.query("select id from public.businesses")).rows[0].id,
  b,
);
await assert.rejects(
  db.query("select public.save_business($1::jsonb)", [
    JSON.stringify({ ...business(a, "Stolen"), owner_id: bob }),
  ]),
  /access denied/,
);
await assert.rejects(
  db.query("update public.businesses set name=$1 where id=$2", ["Stolen", a]),
  /permission denied/,
);
await login(alice);
const link = {
  id: linkA,
  business_id: a,
  platform_id: "google",
  display_name: "Google Reviews",
  destination_url: "https://g.page/r/acme/review",
  is_active: true,
};
await db.query("select public.save_review_link($1::jsonb)", [
  JSON.stringify(link),
]);
for (const url of [
  "http://google.com",
  "javascript:alert(1)",
  "https://google.com.evil.com/reviews",
  "https://evil.com@google.com/reviews",
  "https://127.0.0.1/reviews",
  "https://google.com:8080/reviews",
  "https://google.com/url?url=https://evil.com",
  "https://google.com\\@evil.com",
]) {
  const result = await db.query(
    "select public.valid_review_url($1,$2) as valid",
    ["google", url],
  );
  assert.equal(result.rows[0].valid, false, url);
  await assert.rejects(
    db.query("select public.save_review_link($1::jsonb)", [
      JSON.stringify({ ...link, destination_url: url }),
    ]),
  );
}
await login(bob);
await db.query("select public.save_review_link($1::jsonb)", [
  JSON.stringify({ ...link, id: linkB, business_id: b }),
]);
await login(alice);
const card = {
  id: cardId,
  business_id: a,
  name: "Everyday invitation",
  slug: "everyday-invitation",
  headline: "Your experience matters",
  description: "Choose a platform",
  is_active: true,
  appearance_settings: {
    business_name: "Acme",
    logo_url: "",
    accent: "#4b7fe7",
    background: "#ffffff",
    button_style: "outline",
    radius: "rounded",
  },
  links: [
    { business_review_link_id: linkA, display_order: 0, is_enabled: true },
  ],
};
await db.query("select public.save_review_card($1::jsonb)", [
  JSON.stringify(card),
]);
await assert.rejects(
  db.query("select public.save_review_card($1::jsonb)", [
    JSON.stringify({
      ...card,
      links: [
        { business_review_link_id: linkB, display_order: 0, is_enabled: true },
      ],
    }),
  ]),
  /another business/,
);
assert.equal(
  (await db.query("select business_review_link_id from review_card_links"))
    .rows[0].business_review_link_id,
  linkA,
  "failed mutation rolled back atomically",
);
await assert.rejects(
  db.query("select public.save_review_card($1::jsonb)", [
    JSON.stringify({
      ...card,
      appearance_settings: { button_style: "outline", radius: "rounded" },
    }),
  ]),
  /Invalid appearance/,
);
await assert.rejects(
  db.query("select public.save_review_card($1::jsonb)", [
    JSON.stringify({ ...card, id: "30000000-0000-4000-8000-000000000002" }),
  ]),
  /unique/,
);
await assert.rejects(
  db.query("select public.ingest_review_event($1,$2,$3)", [
    crypto.randomUUID(),
    cardId,
    "page_view",
  ]),
  /permission denied/,
);
await db.exec("reset role");
await db.query(
  "insert into business_members(business_id,user_id,role) values($1,$2,'viewer')",
  [a, viewer],
);
await login(viewer);
assert.equal((await db.query("select id from review_cards")).rows.length, 1);
await assert.rejects(
  db.query("select public.save_review_card($1::jsonb)", [JSON.stringify(card)]),
  /access denied/,
);
await login(bob);
assert.equal((await db.query("select id from review_cards")).rows.length, 0);
await assert.rejects(
  db.query("select public.delete_review_card($1)", [cardId]),
  /access denied/,
);
assert.equal(
  (await db.query("select * from workspace_events($1)", [a])).rows.length,
  0,
);
await db.exec("reset role");
await db.query("select public.ingest_review_event($1,$2,$3)", [
  crypto.randomUUID(),
  cardId,
  "page_view",
]);
const eventId = crypto.randomUUID();
await db.query("select public.ingest_review_event($1,$2,$3,$4)", [
  eventId,
  cardId,
  "outbound_click",
  linkA,
]);
await db.query("select public.ingest_review_event($1,$2,$3,$4)", [
  eventId,
  cardId,
  "outbound_click",
  linkA,
]);
assert.equal(
  (await db.query("select count(*) as count from review_card_events")).rows[0]
    .count,
  2,
);
await login(alice);
const events = await db.query("select * from workspace_events($1)", [a]);
assert.equal(
  events.rows.reduce((sum, row) => sum + row.count, 0),
  2,
);
await db.query("select public.save_review_link($1::jsonb)", [
  JSON.stringify({ ...link, is_active: false }),
]);
assert.equal(
  (await db.query("select is_active from review_cards")).rows[0].is_active,
  false,
  "disabling final destination deactivates card",
);
await assert.rejects(
  db.query("select public.save_review_card($1::jsonb)", [JSON.stringify(card)]),
  /enabled destination/,
);
await db.exec("reset role;set role anon");
await assert.rejects(db.query("select * from businesses"), /permission denied/);
await assert.rejects(
  db.query("select public.workspace_events($1)", [a]),
  /permission denied/,
);

await login(alice);
const getDraft = async (newBusiness = false) =>
  (await db.query("select public.begin_onboarding($1) as draft", [newBusiness]))
    .rows[0].draft;
let draft = await getDraft(true);
assert.equal((await getDraft()).id, draft.id, "begin is idempotent");
const onboardingData = {
  name: "Alice Owner",
  avatar: "",
  business: business(draft.business_id, "Bright Studio"),
  links: [
    {
      ...link,
      id: "20000000-0000-4000-8000-000000000010",
      business_id: draft.business_id,
    },
  ],
  card: {
    template: "split",
    slug: "acme-card",
    headline: "Share your experience.",
    description: "Every experience is welcome.",
    accent: "#4b7fe7",
    button_style: "soft",
    radius: "rounded",
  },
};
const saveDraft = async (data, step = 4) =>
  (
    await db.query(
      "select public.save_onboarding_draft($1,$2::jsonb,$3,$4) as draft",
      [draft.id, JSON.stringify(data), step, draft.revision],
    )
  ).rows[0].draft;
draft = await saveDraft(onboardingData);
assert.equal(
  (
    await db.query("select id from business_members where business_id=$1", [
      draft.business_id,
    ])
  ).rows.length,
  1,
);
await assert.rejects(
  db.query("select public.save_onboarding_draft($1,$2::jsonb,4,$3)", [
    draft.id,
    JSON.stringify(onboardingData),
    draft.revision - 1,
  ]),
  /another tab/,
);
await login(bob);
assert.equal(
  (await db.query("select id from onboarding_drafts where id=$1", [draft.id]))
    .rows.length,
  0,
);
await assert.rejects(
  db.query("select public.publish_onboarding($1,$2)", [
    draft.id,
    draft.revision,
  ]),
  /access denied/,
);
await login(alice);
const existingSlug = (
  await db.query("select slug from review_cards where id=$1", [cardId])
).rows[0].slug;
onboardingData.card.slug = existingSlug;
draft = await saveDraft(onboardingData);
assert.equal(
  (
    await db.query("select public.check_onboarding_slug($1,$2) as available", [
      existingSlug,
      draft.card_id,
    ])
  ).rows[0].available,
  false,
);
await assert.rejects(
  db.query("select public.publish_onboarding($1,$2)", [
    draft.id,
    draft.revision,
  ]),
  /unique constraint/,
);
assert.equal(
  (
    await db.query("select completed_at from onboarding_drafts where id=$1", [
      draft.id,
    ])
  ).rows[0].completed_at,
  null,
);
assert.equal(
  (
    await db.query(
      "select id from business_review_links where business_id=$1",
      [draft.business_id],
    )
  ).rows.length,
  0,
  "failed publication rolls back platform inserts",
);
onboardingData.card.slug = "bright-studio";
onboardingData.links[0].destination_url = "https://google.com.evil.com/reviews";
draft = await saveDraft(onboardingData);
await assert.rejects(
  db.query("select public.publish_onboarding($1,$2)", [
    draft.id,
    draft.revision,
  ]),
  /Invalid HTTPS/,
);
onboardingData.links[0].destination_url = "https://g.page/r/acme/review";
onboardingData.links[0].id = linkA;
draft = await saveDraft(onboardingData);
await assert.rejects(
  db.query("select public.publish_onboarding($1,$2)", [
    draft.id,
    draft.revision,
  ]),
  /access denied/,
);
onboardingData.links[0].id = "20000000-0000-4000-8000-000000000010";
onboardingData.card.background = "#edf2f8";
onboardingData.card.border_style = "dashed";
onboardingData.card.background_style = "abstract";
onboardingData.card.page_background = "#042751";
onboardingData.card.border_color = "#042751";
draft = await saveDraft(onboardingData);
const published = (
  await db.query("select public.publish_onboarding($1,$2) as result", [
    draft.id,
    draft.revision,
  ])
).rows[0].result;
assert.equal(published.card.appearance_settings.background, "#edf2f8");
assert.equal(published.card.appearance_settings.border_style, "dashed");
assert.equal(published.card.appearance_settings.border_color, "#042751");
await db.exec("reset role");
await db.query(
  "update public.review_cards set appearance_settings=appearance_settings || $1::jsonb where id=$2",
  [
    JSON.stringify({ title_color: "#042751", paragraph_color: "#52647b" }),
    published.card.id,
  ],
);
await db.exec("set role authenticated");
const publicBorder = (
  await db.query("select public.published_review_card($1) as card", [
    published.card.slug,
  ])
).rows[0].card;
assert.equal(publicBorder.appearance_settings.border_style, "dashed");
assert.equal(publicBorder.appearance_settings.title_color, "#042751");
assert.equal(publicBorder.appearance_settings.paragraph_color, "#52647b");
assert.equal(publicBorder.appearance_settings.background_style, "abstract");
assert.equal(publicBorder.appearance_settings.page_background, "#042751");
assert.equal(publicBorder.appearance_settings.border_color, "#042751");
assert.ok(published.draft.completed_at);
assert.equal(published.draft.step, 5);
assert.ok(
  (
    await db.query(
      "select onboarding_completed_at from businesses where id=$1",
      [draft.business_id],
    )
  ).rows[0].onboarding_completed_at,
);
assert.equal(
  (
    await db.query("select public.publish_onboarding($1,$2) as result", [
      draft.id,
      draft.revision,
    ])
  ).rows[0].result.card.id,
  published.card.id,
  "publish retries are idempotent",
);
await assert.rejects(
  db.query("select public.save_onboarding_draft($1,$2::jsonb,4,$3)", [
    draft.id,
    JSON.stringify(onboardingData),
    published.draft.revision,
  ]),
  /already been published/,
);
const second = await getDraft(true);
assert.notEqual(second.business_id, draft.business_id);
assert.equal(
  (
    await db.query("select name from businesses where id=$1", [
      draft.business_id,
    ])
  ).rows[0].name,
  "Bright Studio",
);
const status = (await db.query("select public.onboarding_status() as status"))
  .rows[0].status;
assert.equal(status.draft.id, second.id);
assert.ok(
  status.businesses.some((b) => b.id === draft.business_id && b.complete),
);
await db.exec("reset role;set role anon");
const publicCard = (
  await db.query("select public.published_review_card('bright-studio') as card")
).rows[0].card;
assert.equal(publicCard.appearance_settings.template, "split");
assert.equal(publicCard.destinations.length, 1);
assert.equal(
  publicCard.destinations[0].destination_url,
  "https://g.page/r/acme/review",
);
assert.equal(Object.hasOwn(publicCard, "business_id"), false);
assert.equal(Object.hasOwn(publicCard, "owner_id"), false);
assert.equal(
  (
    await db.query("select public.published_review_card($1) as card", [
      existingSlug,
    ])
  ).rows[0].card,
  null,
);
await assert.rejects(
  db.query("select public.onboarding_status()"),
  /permission denied/,
);
await assert.rejects(
  db.query("select * from onboarding_drafts"),
  /permission denied/,
);
console.log(
  "PASS: private server drafts, revision conflicts, atomic publication, real public projection, slug collisions, URL validation, cross-business denial, completion status, retry safety, and new-business isolation.",
);

await login(bob);
const legacyDraft = await getDraft();
assert.equal(
  legacyDraft.business_id,
  b,
  "unfinished owned business is resumed rather than duplicated",
);
assert.equal(legacyDraft.draft.business.slug, "studio");
await db.query("select public.save_onboarding_draft($1,$2::jsonb,2,$3)", [
  legacyDraft.id,
  JSON.stringify({ ...legacyDraft.draft, name: "Bob Owner" }),
  legacyDraft.revision,
]);
assert.equal(
  (await db.query("select slug from businesses where id=$1", [b])).rows[0].slug,
  "studio",
  "resume preserves the existing business slug",
);
await db.exec(
  "reset role;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated",
);
await login(alice);
await db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
  "business-assets",
  a + "/logo.png",
]);
await db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
  "profile-assets",
  alice + "/avatar.png",
]);
await login(bob);
await assert.rejects(
  db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
    "business-assets",
    a + "/stolen.png",
  ]),
  /row-level security/,
);
await assert.rejects(
  db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
    "profile-assets",
    alice + "/stolen.png",
  ]),
  /row-level security/,
);
console.log(
  "PASS: business/profile Storage upload policies enforce ownership.",
);
await db.exec("reset role");
await db.exec(
  await readFile(
    "supabase/migrations/202610090007_review_card_publication.sql",
    "utf8",
  ),
);
await db.query(
  "update businesses set onboarding_completed_at=now() where id=$1",
  [a],
);
await db.query(
  "update business_review_links set is_active=true where id in ($1,$2)",
  [linkA, linkB],
);
await login(alice);
const publishable = {
  ...card,
  id: crypto.randomUUID(),
  slug: "new-public-card",
  is_active: true,
};
await db.query("select public.save_review_card($1::jsonb)", [
  JSON.stringify(publishable),
]);
assert.ok(
  (
    await db.query("select published_at from review_cards where id=$1", [
      publishable.id,
    ])
  ).rows[0].published_at,
);
assert.ok(
  (
    await db.query("select public.published_review_card($1) as card", [
      publishable.slug,
    ])
  ).rows[0].card,
);
await db.query("select public.save_review_card($1::jsonb)", [
  JSON.stringify({ ...publishable, is_active: false }),
]);
assert.equal(
  (
    await db.query("select public.published_review_card($1) as card", [
      publishable.slug,
    ])
  ).rows[0].card,
  null,
);
await db.query("select public.save_review_card($1::jsonb)", [
  JSON.stringify({ ...publishable, is_active: true }),
]);
assert.ok(
  (
    await db.query("select public.published_review_card($1) as card", [
      publishable.slug,
    ])
  ).rows[0].card,
);
await login(bob);
const privateCard = {
  ...card,
  id: crypto.randomUUID(),
  business_id: b,
  slug: "unfinished-workspace-card",
  links: [
    { business_review_link_id: linkB, display_order: 0, is_enabled: true },
  ],
};
await db.query("select public.save_review_card($1::jsonb)", [
  JSON.stringify(privateCard),
]);
assert.equal(
  (
    await db.query("select published_at from review_cards where id=$1", [
      privateCard.id,
    ])
  ).rows[0].published_at,
  null,
);
console.log(
  "PASS: new active cards publish only in completed workspaces; deactivation hides and reactivation restores public access.",
);
await db.close();
console.log(
  "PASS: migration, URL validation, card atomicity, slug uniqueness, ownership, membership, viewer restrictions, anonymous denial, event deduplication, and empty-card deactivation.",
);
