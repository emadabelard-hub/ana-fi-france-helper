// Tests for signature-email-invite edge function.
// Mocks Supabase admin client + Resend fetch, then exercises the handler
// via HTTP against a locally-served instance of the function.
//
// Run with: deno test --allow-net --allow-env --allow-read

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

type DocRow = { document_number: string; document_type: string; client_name: string; client_email: string | null };
type SigRow = { id: string; document_id: string; user_id: string; status: string } | null;

interface Fixture {
  sigRow: SigRow;
  docRow: DocRow | null;
  profileRow: { company_name: string; full_name: string; email: string } | null;
  resendStatus: number;
  resendBody: string;
}

let fixture: Fixture;
let lastResendPayload: any = null;

// Stub the Supabase createClient import used by the function.
const supabaseStubUrl = new URL("./_supabase_stub.ts", import.meta.url);
await Deno.writeTextFile(
  new URL(supabaseStubUrl).pathname,
  `export function createClient() {
    return {
      from(table) {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: async () => {
            const g = (globalThis as any).__sigInviteFixture;
            if (table === "signature_requests") return { data: g.sigRow, error: g.sigRow ? null : { message: "not found" } };
            if (table === "documents_comptables") return { data: g.docRow, error: null };
            if (table === "profiles") return { data: g.profileRow, error: null };
            return { data: null, error: null };
          },
        };
      },
    };
  }`,
);

// Intercept fetch: for Resend API, return the fixture; for anything else, throw.
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith("https://api.resend.com/")) {
    lastResendPayload = init?.body ? JSON.parse(init.body as string) : null;
    return new Response(fixture.resendBody, { status: fixture.resendStatus });
  }
  return realFetch(input as any, init);
}) as typeof fetch;

// Inject env vars the function reads.
Deno.env.set("SUPABASE_URL", "http://stub");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-service-key");
Deno.env.set("RESEND_API_KEY", "stub-resend-key");

// Rewrite the Supabase SDK import to our stub before importing the handler.
const originalImport = "https://esm.sh/@supabase/supabase-js@2.93.1";
const handlerSrc = (await Deno.readTextFile(new URL("./index.ts", import.meta.url)))
  .replace(originalImport, "./_supabase_stub.ts")
  .replace(/Deno\.serve\(/, "export const handler = (");
const patchedUrl = new URL("./_handler_under_test.ts", import.meta.url);
await Deno.writeTextFile(
  new URL(patchedUrl).pathname,
  handlerSrc.replace(/Deno\.serve\(async \(req\) => \{/, "export const handler = async (req: Request) => {"),
);
const { handler } = await import(patchedUrl.toString()) as { handler: (req: Request) => Promise<Response> };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function call(body: unknown, method = "POST") {
  return handler(new Request("http://local/", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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
  const j = await res.json();
  assertEquals(j.error, "Jeton de signature manquant.");
});

Deno.test("404 when signature not found", async () => {
  resetFixture({ sigRow: null });
  const res = await call({ token: "missing" });
  assertEquals(res.status, 404);
  await res.text();
});

Deno.test("400 when no recipient email available", async () => {
  resetFixture(); // docRow.client_email is null and no override
  const res = await call({ token: "abc" });
  assertEquals(res.status, 400);
  const j = await res.json();
  assertEquals(j.error, "Adresse e-mail du client requise.");
});

Deno.test("400 when overrideEmail is invalid and no fallback", async () => {
  resetFixture();
  const res = await call({ token: "abc", recipientEmail: "not-an-email" });
  assertEquals(res.status, 400);
  await res.text();
});

Deno.test("uses recipientEmail from UI when valid (priority over client_email)", async () => {
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

Deno.test("falls back to documents_comptables.client_email when override missing", async () => {
  resetFixture({
    docRow: { document_number: "D-1", document_type: "devis", client_name: "Ada", client_email: "stored@client.fr" },
  });
  const res = await call({ token: "abc" });
  assertEquals(res.status, 200);
  await res.text();
  assertEquals(lastResendPayload.to, ["stored@client.fr"]);
});

Deno.test("ignores invalid override and falls back to stored client_email", async () => {
  resetFixture({
    docRow: { document_number: "D-1", document_type: "devis", client_name: "Ada", client_email: "stored@client.fr" },
  });
  const res = await call({ token: "abc", recipientEmail: "  " });
  assertEquals(res.status, 200);
  await res.text();
  assertEquals(lastResendPayload.to, ["stored@client.fr"]);
});

Deno.test("502 when Resend rejects", async () => {
  resetFixture({
    docRow: { document_number: "D-1", document_type: "devis", client_name: "Ada", client_email: "x@client.fr" },
    resendStatus: 422,
    resendBody: JSON.stringify({ message: "bad" }),
  });
  const res = await call({ token: "abc" });
  assertEquals(res.status, 502);
  await res.text();
});

Deno.test("omits reply_to when artisan email invalid", async () => {
  resetFixture({
    docRow: { document_number: "D-1", document_type: "devis", client_name: "Ada", client_email: "x@client.fr" },
    profileRow: { company_name: "Acme", full_name: "Boss", email: "" },
  });
  const res = await call({ token: "abc" });
  assertEquals(res.status, 200);
  await res.text();
  assertEquals(lastResendPayload.reply_to, undefined);
});
