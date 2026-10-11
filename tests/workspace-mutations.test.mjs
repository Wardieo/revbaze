import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
let state, loadedId, resolveLoad;
const cacheWrites = [],
  invalidations = [];
const emptyWorkspace = () => ({
  business: null,
  cards: [],
  links: [],
  events: [],
  activity: [],
});
globalThis.__workspaceTest = {
  create: (initializer) => {
    state = initializer(
      (value) => {
        state = { ...state, ...value };
      },
      () => state,
    );
    return { getState: () => state };
  },
  emptyWorkspace,
  queryClient: {
    setQueriesData: (filter, data) => cacheWrites.push({ filter, data }),
    invalidateQueries: (filter) => invalidations.push(filter),
  },
  repository: {
    loadWorkspace: async (id) => {
      loadedId = id;
      return new Promise((resolve) => (resolveLoad = resolve));
    },
  },
};
let source = await readFile("src/stores/workspace.ts", "utf8");
source = source.replace(/^import .*?;\n/gms, (match) =>
  match.startsWith("import type") ? match : "",
);
// Remove runtime imports individually, preserving the store implementation.
source = source.slice(source.indexOf("export const useWorkspace"));
const code =
  "const {create,emptyWorkspace,queryClient,repository}=globalThis.__workspaceTest;\n" +
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText;
const { useWorkspace } = await import(
  "data:text/javascript;base64," + Buffer.from(code).toString("base64")
);
const original = { ...emptyWorkspace(), business: { id: "business-b" } };
useWorkspace.getState().hydrate(original);
const save = useWorkspace.getState().mutate(async () => {});
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(loadedId, "business-b");
const updated = { ...original, cards: [{ id: "new-card" }] };
resolveLoad(updated);
await save;
assert.equal(useWorkspace.getState().cards[0].id, "new-card");
assert.equal(
  cacheWrites[0].filter.predicate({
    queryKey: ["workspace", "user", "business-b"],
  }),
  true,
);
assert.equal(
  cacheWrites[0].filter.predicate({
    queryKey: ["workspace", "user", "business-a"],
  }),
  false,
);
assert.deepEqual(invalidations, [
  { queryKey: ["account-plan"] },
  { queryKey: ["card-performance"] },
  { queryKey: ["overview-summary"] },
  { queryKey: ["analytics-summary"] },
  { queryKey: ["analytics-business-comparison"] },
]);
const late = useWorkspace.getState().mutate(async () => {});
await new Promise((resolve) => setTimeout(resolve, 0));
useWorkspace
  .getState()
  .hydrate({ ...emptyWorkspace(), business: { id: "business-c" } });
resolveLoad(updated);
await late;
assert.equal(useWorkspace.getState().business.id, "business-c");
assert.equal(cacheWrites.length, 1);
assert.equal(useWorkspace.getState().busy, false);
await assert.rejects(
  useWorkspace.getState().mutate(async () => {
    throw Error("Save failed");
  }),
  /Save failed/,
);
assert.equal(useWorkspace.getState().business.id, "business-c");
assert.equal(useWorkspace.getState().busy, false);
console.log(
  "PASS: card mutations reload the selected business, update matching cache and quotas, preserve concurrent business switches, and recover from errors.",
);
