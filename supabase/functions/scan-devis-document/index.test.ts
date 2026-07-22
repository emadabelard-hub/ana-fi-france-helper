import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SUPABASE_URL", "http://localhost:9999");
Deno.env.set("SUPABASE_ANON_KEY", "fake-anon");
Deno.env.set("ANTHROPIC_API_KEY", "fake-key");

const originalFetch = globalThis.fetch;

let nextAnthropicResponse: any = null;

globalThis.fetch = (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
  if (url.includes("api.anthropic.com")) {
    return Promise.resolve(new Response(JSON.stringify(nextAnthropicResponse), { status: 200 }));
  }
  if (url.includes("/auth/v1/user")) {
    return Promise.resolve(new Response(JSON.stringify({ id: "user-123", email: "test@example.com", is_anonymous: false }), { status: 200 }));
  }
  return originalFetch(input, init);
};

await import("./index.ts");

async function post(body: any) {
  const res = await fetch("http://localhost:8000", {
    method: "POST",
    headers: { "Authorization": "Bearer fake-token", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res;
}

Deno.test("Test 1: réponse complète et JSON valide → toutes les lignes retournées", async () => {
  nextAnthropicResponse = {
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify({ items: Array.from({ length: 10 }, (_, i) => ({ designation_fr: `Poste ${i + 1}`, quantity: i + 1, unit: "m²", unitPrice: 100 })) }) }],
  };
  const res = await post({ fileData: "fakebase64", mimeType: "image/jpeg" });
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.items.length, 10);
});

Deno.test("Test 2: stop_reason === max_tokens → erreur DEVIS_DOCUMENT_TOO_LONG", async () => {
  nextAnthropicResponse = {
    stop_reason: "max_tokens",
    content: [{ type: "text", text: JSON.stringify({ items: [{ designation_fr: "Partiel", quantity: 1, unit: "u", unitPrice: 10 }] }) }],
  };
  const res = await post({ fileData: "fakebase64", mimeType: "image/jpeg" });
  assertEquals(res.status, 413);
  const json = await res.json();
  assertEquals(json.code, "DEVIS_DOCUMENT_TOO_LONG");
  assertEquals((json.items === undefined), true);
});

Deno.test("Test 3: JSON incomplet ou invalide → erreur DEVIS_DOCUMENT_PARSE_ERROR", async () => {
  nextAnthropicResponse = {
    stop_reason: "end_turn",
    content: [{ type: "text", text: "{ invalid json" }],
  };
  const res = await post({ fileData: "fakebase64", mimeType: "image/jpeg" });
  assertEquals(res.status, 422);
  const json = await res.json();
  assertEquals(json.code, "DEVIS_DOCUMENT_PARSE_ERROR");
});

Deno.test("Test 4: document court → fonctionnement identique à avant", async () => {
  nextAnthropicResponse = {
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify({ items: [{ designation_fr: "Petit poste", quantity: 1, unit: "u", unitPrice: 50 }] }) }],
  };
  const res = await post({ fileData: "fakebase64", mimeType: "image/jpeg" });
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.items.length, 1);
  assertEquals(json.items[0].designation_fr, "Petit poste");
});
