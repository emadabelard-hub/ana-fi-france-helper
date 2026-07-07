// Save (encrypt-at-rest) a user's third-party API key.
// Requires a valid Supabase JWT. Never logs or returns the plaintext.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { encryptApiKey } from "../_shared/api-key-crypto.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_KEY_NAMES = new Set(["openai"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7).trim();
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const keyName = String(body?.key_name || "").trim();
    const apiKey = typeof body?.api_key === "string" ? body.api_key.trim() : "";
    const action = body?.action === "delete" ? "delete" : "save";

    if (!ALLOWED_KEY_NAMES.has(keyName)) {
      return new Response(JSON.stringify({ error: "invalid key_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      await admin
        .from("user_api_keys")
        .delete()
        .eq("user_id", userRes.user.id)
        .eq("key_name", keyName);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!apiKey || apiKey.length < 10 || apiKey.length > 500) {
      return new Response(JSON.stringify({ error: "invalid api_key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encrypted = await encryptApiKey(apiKey);
    const { error: upErr } = await admin
      .from("user_api_keys")
      .upsert(
        { user_id: userRes.user.id, key_name: keyName, encrypted_key: encrypted },
        { onConflict: "user_id,key_name" },
      );
    if (upErr) {
      return new Response(JSON.stringify({ error: "save_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
