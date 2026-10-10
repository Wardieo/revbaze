import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { AuthClient } from "@supabase/auth-js";
const dir = await mkdtemp(join(tmpdir(), "revbaze-auth-"));
try {
  const fetchSource = await readFile("src/lib/authFetch.ts", "utf8");
  await writeFile(
    join(dir, "authFetch.mjs"),
    ts.transpileModule(fetchSource, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText,
  );
  const { createAuthFetch } = await import(
    pathToFileURL(join(dir, "authFetch.mjs"))
  );
  const source = await readFile("src/lib/auth.ts", "utf8");
  await writeFile(
    join(dir, "auth.mjs"),
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    }).outputText,
  );
  const { authErrorMessage, confirmationRedirect, callbackDetails } =
    await import(pathToFileURL(join(dir, "auth.mjs")));
  for (const err of [null, {}, new Error("{}"), { message: "[object Object]" }])
    assert.match(authErrorMessage(err), /unexpected response/);
  assert.match(
    authErrorMessage({ code: "email_not_confirmed" }),
    /Confirm your email/,
  );
  assert.match(
    authErrorMessage({ message: "Email address not authorized" }),
    /SMTP/,
  );
  assert.match(
    authErrorMessage({ code: "over_email_send_rate_limit" }),
    /wait/,
  );
  assert.match(
    authErrorMessage(new TypeError("Failed to fetch")),
    /connection/,
  );
  assert.equal(
    confirmationRedirect("https://example.com", "/"),
    "https://example.com/?auth_callback=signup",
  );
  assert.equal(
    confirmationRedirect("https://example.com", "/app/", true),
    "https://example.com/app/?auth_callback=recovery",
  );
  assert.equal(callbackDetails("https://example.com/#/signup").active, false);
  assert.deepEqual(
    callbackDetails(
      "https://example.com/?auth_callback=recovery#access_token=fake&type=recovery",
    ),
    { active: true, recovery: true, error: "" },
  );
  assert.equal(
    callbackDetails(
      "https://example.com/#error=access_denied&error_description=Link+expired",
    ).error,
    "Link expired",
  );
  for (const [body, expected] of [
    [
      {
        message: "Error sending confirmation email",
        code: "unexpected_failure",
      },
      /email provider/,
    ],
    [
      { message: "Database error saving new user", code: "unexpected_failure" },
      /could not save the account/,
    ],
    [{}, /HTTP 500/],
  ]) {
    const client = new AuthClient({
      url: "https://example.supabase.co/auth/v1",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      fetch: createAuthFetch(
        "https://example.supabase.co",
        async () =>
          new Response(JSON.stringify(body), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    });
    const { error } = await client.signUp({
      email: "test@example.com",
      password: "ExamplePass123!",
    });
    assert.equal(error.status, 500);
    assert.match(authErrorMessage(error), expected);
  }
  const untouched = new Response('{"code":"invalid_credentials"}', {
    status: 400,
  });
  assert.equal(
    await createAuthFetch(
      "https://example.supabase.co",
      async () => untouched,
    )("https://example.supabase.co/auth/v1/token"),
    untouched,
  );
  const databaseResponse = new Response("{}", { status: 500 });
  await createAuthFetch(
    "https://example.supabase.co",
    async () => databaseResponse,
  )("https://example.supabase.co/rest/v1/businesses");
  assert.equal(Object.hasOwn(databaseResponse, "message"), false);
  console.log(
    "Auth redirect, error, and actual SDK HTTP 500 preservation tests passed.",
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
