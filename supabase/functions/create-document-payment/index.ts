import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { documentType, returnPath } = await req.json();

    // Map document types to their specific Stripe price IDs
    const priceMap: Record<string, string> = {
      cv: "price_1T6MOlB9zpCtXcxGdns3wj3f",           // 4.00€
      devis: "price_1T6MRwB9zpCtXcxGUJPyu1DU",         // 5.00€
      facture: "price_1T6MS8B9zpCtXcxG1qWx5hvY",       // 5.00€
      quote_to_invoice: "price_1T6MTcB9zpCtXcxGwBqywodz", // 5.00€
      letter: "price_1T6MRwB9zpCtXcxGUJPyu1DU",        // 5.00€ (same as devis)
      smart_devis: "price_1T6XUMB9zpCtXcxGRtL6A0Jf",   // 14.99€
    };

    const priceId = priceMap[documentType] || priceMap.devis;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        user_id: user.id,
        document_type: documentType || "document",
      },
      success_url: `${req.headers.get("origin")}/payment-success?return=${encodeURIComponent(returnPath || "/")}`,
      cancel_url: `${req.headers.get("origin")}${returnPath || "/"}`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
