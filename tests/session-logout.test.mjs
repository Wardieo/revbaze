import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = ts.transpileModule(await readFile('src/hooks/useSession.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
globalThis.window = { setTimeout };
const oldSession = { access_token: 'test-token', user: { id: 'old-user' } };
let current = oldSession, listener, pendingRead, rejectUser = false;
const auth = {
  getUser() { return Promise.resolve({ data: { user: current?.user || null }, error: rejectUser ? new Error("Invalid token") : null }); },
  onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
  getSession() { return pendingRead || Promise.resolve({ data: { session: current }, error: null }); },
};
let state, slot;
function mount() {
  state = []; slot = 0;
  const exports = {};
  const react = { useState(initial) { const i = slot++; state[i] = initial; return [initial, value => { state[i] = value; }]; }, useEffect(effect) { effect(); } };
  new Function('require', 'exports', source)(name => name === 'react' ? react : { supabase: { auth }, authBootstrap: Promise.resolve({ data: { session: oldSession } }) }, exports);
  exports.useSession();
}
const flush = () => new Promise(resolve => setImmediate(resolve));
mount(); await flush(); assert.equal(state[0], oldSession);
current = null; listener('SIGNED_OUT', null); assert.equal(state[0], null);
mount(); await flush(); assert.equal(state[0], null, 'Remount must not restore the bootstrap session after logout');
let finish;
pendingRead = new Promise(resolve => { finish = resolve; });
mount(); await flush(); listener('SIGNED_OUT', null);
finish({ data: { session: oldSession }, error: null }); await flush();
assert.equal(state[0], null, 'A stale session read must not override sign-out');
pendingRead = null; current = oldSession; rejectUser = true;
mount(); await flush(); assert.equal(state[0], null, 'Unverified stored tokens must not unlock dashboard access');
console.log('Session logout regression passed: remount and in-flight session reads cannot resurrect the logged-out user.');
