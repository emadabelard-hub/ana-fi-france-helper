// Tests for signature-email-invite edge function.
// Strategy: shim Deno.serve to capture the handler, and shim globalThis.fetch
// so any import of a Supabase SDK path or Resend endpoint is intercepted.
// The real index.ts is then imported unchanged.
//
// Run with: deno test --allow-net --allow-env --allow-read

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ---- Fixture shared with the stubbed Supabase client ---------------------

interface Fixture {
  sigRow: { id: string; document_id: string; user_id: string; status: string } | null;
  docRow: { document_number: string; document_type: string; client_name: string; client_email: string | null } | null;
  profileRow: { company_name: string; full_name: string; email: string } | null;
  resendStatus: number;
  resendBody: string;
}
let fixture: Fixture;
let lastResendPayload: any = null;

// ---- Intercept fetch (Resend) -------------------------------------------

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
  if (url.startsWith("https://api.resend.com/")) {
    lastResendPayload = init?.body ? JSON.parse(init.body as string) : null;
    return new Response(fixture.resendBody, { status: fixture.resendStatus });
  }
  return realFetch(input as any, init);
}) as typeof fetch;

// ---- Shim Deno.serve to capture the handler --------------------------------

let capturedHandler: ((req: Request) => Response | Promise<Response>) | null = null;
const originalServe = Deno.serve;
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (h: any) => {
  capturedHandler = h;
  // Return a fake HttpServer-like object with a finished promise + no-op shutdown.
  return {
    finished: Promise.resolve(),
    shutdown: async () => {},
    ref: () => {},
    unref: () => {},
  };
};

// ---- Shim the Supabase SDK URL via an import map at runtime is not possible;
// instead we monkey-patch by pre-registering the module in the loader cache
// using a dynamic import of a data URL that re-exports our stub.
// Simpler: override createClient on the module by intercepting via an
// ESM shim served from a data: URL, then replacing the module's export.
// Cleanest supported path: register an import hook via a specifier map is
// unavailable at runtime — so we rely on the fact that our stub is served
// through a small trick: we set an env var the function ignores, but we
// also stub the SDK by importing it first and mutating createClient.

// Import the real SDK then replace createClient with our stub before importing
// the handler. Because ESM bindings are live, mutating the module's named
// export is not permitted; we instead patch the module namespace via the
// module cache by using the URL-level import and reassigning on the object.
// Deno exposes the cached module via dynamic import — mutation of exports is
// not supported. So we fall back to a working technique: pre-set globalThis
// createClient and wrap by using a custom import map.

// ---- Simplest working path: use a --import-map isn't available here.
// Instead we set required env vars and prevent the real SDK from being
// exercised by ensuring the fixture's sigRow drives everything. The real
// createClient call succeeds (constructs an in-memory client); we then
// intercept the network layer via fetch above — the SDK uses fetch for its
// REST calls, so all .from().select().eq().maybeSingle() go through fetch.

Deno.env.set("SUPABASE_URL", "http://stub.local");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service-key");
Deno.env.set("RESEND_API_KEY", "stub-resend-key");

// Extend the fetch shim to also mock PostgREST reads made by the SDK.
const fetchWithSupabase = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;

  if (url.startsWith("https://api.resend.com/")) {
    lastResendPayload = init?.body ? JSON.parse(init.body as string) : null;
    return new Response(fixture.resendBody, { status: fixture.resendStatus });
  }

  if (url.startsWith("http://stub.local/rest/v1/")) {
    const path = url.slice("http://stub.local/rest/v1/".length);
    const table = path.split("?")[0];
    let row: unknown = null;
    if (table === "signature_requests") row = fixture.sigRow;
    else if (table === "documents_comptables") row = fixture.docRow;
    else if (table === "profiles") row = fixture.profileRow;
    // PostgREST returns an array; .maybeSingle() picks first or null.
    const body = row ? [row] : [];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return realFetch(input as any, init);
}) as typeof fetch;
globalThis.fetch = fetchWithSupabase;

// Import the real handler (this triggers Deno.serve, which our shim captures).
await import("./index.ts");
// Restore Deno.serve for cleanliness (not strictly required).
(Deno as any).serve = originalServe;

if (!capturedHandler) throw new Error("handler was not captured from Deno.serve");
const handler: (req: Request) => Response | Promise<Response> = capturedHandler;

// ---- Helpers -------------------------------------------------------------

function resetFixture(overrides: Partial<Fixture> = {}) {
  fixture = {
    sigRow: { id: "sig-1", document_id: "doc-1", user_id: "user-1", status: "pending" },
    docRow: { document_number: "D-2025-001", document_type: "devis", client_name: "Ada", client_email: null },
    profileRow: { company_name: "Acme", full_name: "Boss", email: "boss@acme.fr" },
    resendStatus: 200,
    resendBody: JSON.stringify({ id: "email-1" }),
    ...overrides,
  };
  (globalThis as any).__sigInviteFixture = fixture;
  lastResendPayload = null;
}

const call = (body: unknown, method: string = "POST") =>
  handler(new Request("http://local/", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  }));

// ---- Tests ---------------------------------------------------------------

Deno.test("OPTIONS returns CORS preflight", async () => {
  resetFixture();
  const res = await call({}, "OPTIONS");
  assertEquals(res.status, 200);
  await res.text();
});

Deno.test("400 when token missing", async () => {
  resetFixture();
  const res = await call({});
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "Jeton de signature manquant.");
});

Deno.test("404 when signature row not found", async () => {
  resetFixture({ sigRow: null });
  const res = await call({ token: "missing" });
  assertEquals(res.status, 404);
  await res.text();
});

Deno.test("400 when no recipient email is available", async () => {
  resetFixture(); // docRow.client_email null, no override
  const res = await call({ token: "abc" });
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "Adresse e-mail du client requise.");
});

Deno.test("400 when overrideEmail invalid and no stored fallback", async () => {
  resetFixture();
  const res = await call({ token: "abc", recipientEmail: "not-an-email" });
  assertEquals(res.status, 400);
  await res.text();
});

Deno.test("recipientEmail from UI takes priority over stored client_email", async () => {
  resetFixture({
    docRow: { document_number: "D-1", document_type: "devis", client_name: "Ada", client_email: "old@client.fr" },
  });
  const res = await call({ token: "abc", recipientEmail: "new@client.fr" });
  assertEquals(res.status, 200);
  await res.text();
  assertEquals(lastResendPayload.to, ["new@client.fr"]);
  assertEquals(lastResendPayload.reply_to, "boss@acme.fr");
  assertEquals(lastResendPayload.from, "ANAFYPRO <noreply@anafypro.com>");
});

Deno.test("falls back to documents_comptables.client_email when no override", async () => {
  resetFixture({
    docRow: { document_number: "D-1", document_type: "devis", client_name: "Ada", client_email: "stored@client.fr" },
  });
  const res = await call({ token: "abc" });
  assertEquals(res.status, 200);
  await res.text();
  assertEquals(lastResendPayload.to, ["stored@client.fr"]);
});

Deno.test("ignores blank override and falls back to stored client_email", async () => {
  resetFixture({
    docRow: { document_number: "D-1", document_type: "devis", client_name: "Ada", client_email: "stored@client.fr" },
  });
  const res = await call({ token: "abc", recipientEmail: "   " });
  assertEquals(res.status, 200);
  await res.text();
  assertEquals(lastResendPayload.to, ["stored@client.fr"]);
});

Deno.test("502 when Resend rejects the request", async () => {
  resetFixture({
    docRow: { document_number: "D-1", document_type: "devis", client_name: "Ada", client_email: "x@client.fr" },
    resendStatus: 422,
    resendBody: JSON.stringify({ message: "bad" }),
  });
  const res = await call({ token: "abc" });
  assertEquals(res.status, 502);
  await res.text();
});

Deno.test("omits reply_to when artisan profile email is invalid/empty", async () => {
  resetFixture({
    docRow: { document_number: "D-1", document_type: "devis", client_name: "Ada", client_email: "x@client.fr" },
    profileRow: { company_name: "Acme", full_name: "Boss", email: "" },
  });
  const res = await call({ token: "abc" });
  assertEquals(res.status, 200);
  await res.text();
  assertEquals(lastResendPayload.reply_to, undefined);
});
