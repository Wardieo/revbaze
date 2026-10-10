import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role;');
await db.exec(await readFile(new URL('../supabase/migrations/202610090014_contact_messages.sql', import.meta.url), 'utf8'));
const send = (id, email = 'hello@example.com', topic = 'Product question') => db.query(
  'select public.submit_contact_message($1,$2,$3,$4,$5,$6)',
  [id, ' Alex ', email, topic, 'Please help me create my review card.', 'test-source'],
);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
await send(id(1));
await send(id(1));
let result = await db.query('select * from public.contact_messages');
assert.equal(result.rows.length, 1, 'Retries must not create duplicate messages');
assert.equal(result.rows[0].name, 'Alex');
for (let n = 2; n <= 5; n++) await send(id(n));
await assert.rejects(send(id(6)), /Contact submission limit reached/);
assert.equal((await db.query('select count(*)::int as count from public.contact_messages')).rows[0].count, 5);
await db.exec("update public.contact_submission_limits set window_start=now()-interval '2 hours'");
await send(id(6));
await assert.rejects(send(id(7), 'other@example.com', 'Forged topic'), /check constraint/);
for (const role of ['anon', 'authenticated']) {
  await db.exec(`set role ${role}`);
  await assert.rejects(db.query('select * from public.contact_messages'), /permission denied/);
  await assert.rejects(send(id(8)), /permission denied/);
  await db.exec('reset role');
}
await db.close();
console.log('Contact inbox: persistence, retries, limits, validation and permissions passed.');
