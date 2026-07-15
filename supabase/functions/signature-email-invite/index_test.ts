// Tests for signature-email-invite edge function.
// Approach: copy index.ts into a sibling file, patch the Supabase SDK import
// to a local stub, and convert Deno.serve(handler) into an exported handler.
// Then exercise the handler as a plain async function.
//
// Run with: deno test --allow-net --allow-env --allow-read --allow-write

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

// ---- Write the Supabase stub used by the patched handler -----------------

const stubPath = new URL("./_supabase_stub.ts", import.meta.url).pathname;
await Deno.writeTextFile(
  stubPath,
  `export function createClient() {
  return {
    from(table) {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => {
          const g = globalThis.__sigInviteFixture;
          if (table === "signature_requests")
            return { data: g.sigRow, error: g.sigRow ? null : { message: "not found" } };
          if (table === "documents_comptables") return { data: g.docRow, error: null };
          if (table === "profiles") return { data: g.profileRow, error: null };
          return { data: null, error: null };
        },
      };
      return q;
    },
  };
}
`,
);

// ---- Build a patched copy of index.ts that exports a handler -------------

const originalImport = "https://esm.sh/@supabase/supabase-js@2.93.1";
const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const patched = src
  .replace(originalImport, "./_supabase_stub.ts")
  .replace("Deno.serve(async (req) => {", "export const handler = async (req: Request): Promise<Response> => {");
const patchedPath = new URL("./_handler_under_test.ts", import.meta.url).pathname;
// The original ends with `});` — strip the trailing `)` from Deno.serve wrapper.
await Deno.writeTextFile(patchedPath, patched.replace(/\}\);\s*$/, "};\n"));

// ---- Intercept fetch to mock Resend --------------------------------------

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
  if (url.startsWith("https://api.resend.com/")) {
    lastResendPayload = init?.body ? JSON.parse(init.body as string) : null;
    return new Response(fixture.resendBody, { status: fixture.resendStatus });
  }
  return realFetch(input as any, init);
}) as typeof fetch;

Deno.env.set("SUPABASE_URL", "http://stub");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub");
Deno.env.set("RESEND_API_KEY", "stub");

const { handler } = await import(new URL("./_handler_under_test.ts", import.meta.url).toString()) as {
  handler: (req: Request) => Promise<Response>;
};

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

Deno.test("400 when no recipient email is available at all", async () => {
  resetFixture();
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
