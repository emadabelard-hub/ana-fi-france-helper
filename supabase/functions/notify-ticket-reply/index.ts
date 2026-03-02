import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) throw new Error("Admin only");

    const { ticket_id, user_email, admin_reply, original_message } = await req.json();

    if (!user_email || !admin_reply) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use Lovable AI to generate email content
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let emailHtml = `<div style="font-family:Arial,sans-serif;direction:rtl;padding:20px;max-width:600px;margin:0 auto;">
      <div style="background:#f59e0b;padding:16px;border-radius:8px 8px 0 0;text-align:center;">
        <h2 style="color:#fff;margin:0;">🛠️ رد من فريق نصوح</h2>
      </div>
      <div style="background:#ffffff;padding:24px;border:1px solid #e2e8f0;">
        <p style="color:#374151;"><strong>رسالتك:</strong></p>
        <p style="background:#f8fafc;padding:12px;border-radius:6px;color:#4b5563;">${original_message}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
        <p style="color:#374151;"><strong>الرد:</strong></p>
        <p style="background:#fef3c7;padding:12px;border-radius:6px;color:#1f2937;">${admin_reply}</p>
      </div>
      <div style="background:#f9fafb;padding:12px;border-radius:0 0 8px 8px;text-align:center;border:1px solid #e2e8f0;border-top:none;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">فريق الدعم - نصوح | Ana Fi France</p>
      </div>
    </div>`;

    if (LOVABLE_API_KEY) {
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `You are an email formatter. Generate a short, professional HTML email in Egyptian Arabic (عامية مصرية) notifying the user that their support ticket received a reply. Use the persona "نصوح" (Nossouh). Keep it warm, brief, and artisan-friendly. Return ONLY the HTML body content (no <html>, <head>, <body> tags). Use inline styles. Use a warm color scheme with #f59e0b as accent.`,
              },
              {
                role: "user",
                content: `Original message: "${original_message}"\n\nAdmin reply: "${admin_reply}"\n\nGenerate the email HTML.`,
              },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const generatedHtml = aiData.choices?.[0]?.message?.content;
          if (generatedHtml) emailHtml = generatedHtml;
        }
      } catch (aiError) {
        console.warn("AI generation failed, using fallback template:", aiError);
      }
    }

    // Send actual email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;

    if (RESEND_API_KEY) {
      try {
        const resendResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Ana Fi France <onboarding@resend.dev>",
            to: [user_email],
            subject: "🛠️ رد على تذكرتك - نصوح",
            html: emailHtml,
          }),
        });

        if (resendResp.ok) {
          emailSent = true;
          console.log(`✅ Email sent to ${user_email} for ticket ${ticket_id}`);
        } else {
          const errData = await resendResp.text();
          console.error(`❌ Resend error [${resendResp.status}]: ${errData}`);
        }
      } catch (resendError) {
        console.error("Resend API call failed:", resendError);
      }
    } else {
      console.warn("RESEND_API_KEY not configured, email not sent");
    }

    return new Response(JSON.stringify({ 
      success: true, 
      email_sent: emailSent,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-ticket-reply error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
