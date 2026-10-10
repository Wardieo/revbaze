import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = ts.transpileModule(await readFile('src/lib/queryClient.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
const reactQuery = await import('@tanstack/react-query');
new Function('require', 'exports', source)(() => reactQuery, exports);
const client = exports.queryClient;
let calls = 0;
const load = () => Promise.resolve({ count: ++calls });
const key = ['workspace', 'owner-a', 'business-a'];
try {
  const first = await client.fetchQuery({ queryKey: key, queryFn: load });
  assert.deepEqual(await client.fetchQuery({ queryKey: key, queryFn: load }), first);
  assert.equal(calls, 1, 'Fresh navigation must reuse cached data');
  assert.equal(client.getQueryData(['workspace', 'owner-b', 'business-a']), undefined);
  assert.equal(client.getQueryData(['workspace', 'owner-a', 'business-b']), undefined);
  await client.invalidateQueries({ queryKey: key });
  await client.fetchQuery({ queryKey: key, queryFn: load });
  assert.equal(calls, 2, 'Invalidated data must refresh');
  client.clear();
  assert.equal(client.getQueryData(key), undefined);
  console.log('PASS: fresh cache reuse, account/business isolation, invalidation and logout cache clearing.');
} finally { client.clear(); }
