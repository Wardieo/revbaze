import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile("src/hooks/usePublicSlug.ts", "utf8");
const compiled = ts.transpileModule(
  source.replace(/^import .*;\n/gm, "").replace("export function", "function"),
  { compilerOptions: { target: ts.ScriptTarget.ES2023 } },
).outputText;
const { slugify, validateSlug } = new Function(
  ts.transpileModule(
    (await readFile("src/lib/validation.ts", "utf8"))
      .replace(/^import .*;\n/gm, "")
      .replaceAll("export function", "function")
      .replaceAll("import.meta.env", "({})"),
    { compilerOptions: { target: ts.ScriptTarget.ES2023 } },
  ).outputText + "\nreturn {slugify, validateSlug};",
)();

async function check({
  slug = "test-business",
  automatic = true,
  name = "Test Business",
  available,
  cancel = false,
}) {
  const effects = [];
  const results = [];
  const generated = [];
  const requests = [];
  let timer;
  const hook = new Function(
    "useEffect",
    "useRef",
    "useState",
    "slugAvailable",
    "slugify",
    "validateSlug",
    "setTimeout",
    "clearTimeout",
    "crypto",
    compiled + "\nreturn usePublicSlug;",
  )(
    (effect) => effects.push(effect),
    (current) => ({ current }),
    (initial) => [initial, (next) => results.push(next)],
    async (candidate, cardId) => {
      requests.push([candidate, cardId]);
      return available(candidate);
    },
    slugify,
    validateSlug,
    (callback) => {
      timer = callback;
      return 1;
    },
    () => {},
    { randomUUID: () => "12345678-1234-1234-1234-123456789012" },
  );
  hook({
    slug,
    automatic,
    name,
    cardId: "current-card",
    onGenerated: (next) => generated.push(next),
  });
  effects[0]();
  const cleanup = effects[1]();
  if (cancel) cleanup();
  await timer();
  return { results, generated, requests };
}

let result = await check({ available: () => true });
assert.deepEqual(result.generated, []);
assert.deepEqual(result.results, [{ slug: "test-business", message: "" }]);
assert.deepEqual(result.requests, [["test-business", "current-card"]]);
result = await check({
  available: (candidate) => candidate !== "test-business",
});
assert.deepEqual(result.generated, ["test-business-12345678"]);
assert.equal(result.results[0].message, "");
result = await check({ automatic: false, available: () => false });
assert.deepEqual(result.generated, []);
assert.match(result.results[0].message, /already taken/);
result = await check({ slug: "admin", name: "Admin", available: () => true });
assert.deepEqual(result.generated, ["admin-reviews-12345678"]);
result = await check({
  automatic: false,
  slug: "Invalid Slug",
  available: () => true,
});
assert.equal(result.requests.length, 0);
assert.match(result.results[0].message, /lowercase/);
result = await check({
  available: () => {
    throw new Error("Network unavailable");
  },
});
assert.equal(result.results[0].message, "Network unavailable");
result = await check({ cancel: true, available: () => true });
assert.deepEqual(result.results, []);
assert.deepEqual(result.generated, []);
console.log(
  "PASS: slug availability, automatic collision recovery, reserved names, manual input, request errors, and cancellation.",
);
