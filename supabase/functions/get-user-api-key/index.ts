// Return the decrypted plaintext of the calling user's own API key.
// Requires a valid Supabase JWT. Only returns the key to its owner.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { decryptApiKey } from "../_shared/api-key-crypto.ts";

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
    if (!ALLOWED_KEY_NAMES.has(keyName)) {
      return new Response(JSON.stringify({ error: "invalid key_name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await admin
      .from("user_api_keys")
      .select("encrypted_key")
      .eq("user_id", userRes.user.id)
      .eq("key_name", keyName)
      .maybeSingle();
    if (error) {
      return new Response(JSON.stringify({ error: "read_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!data?.encrypted_key) {
      return new Response(JSON.stringify({ has_key: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const plaintext = await decryptApiKey(data.encrypted_key);
    return new Response(JSON.stringify({ has_key: true, api_key: plaintext }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
