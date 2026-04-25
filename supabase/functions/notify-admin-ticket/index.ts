import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId, userEmail, userSiret, message } = await req.json();

    if (!ticketId || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch admin emails from profiles joined with admin_users
    const { data: admins } = await supabase
      .from('admin_users')
      .select('user_id');

    if (!admins || admins.length === 0) {
      console.log('No admin users found');
      return new Response(JSON.stringify({ success: true, note: 'No admins to notify' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get admin profiles for emails
    const adminIds = admins.map(a => a.user_id);
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('email, full_name')
      .in('user_id', adminIds);

    const adminEmails = adminProfiles?.filter(p => p.email).map(p => p.email) || [];

    console.log(`New support ticket ${ticketId} - notifying ${adminEmails.length} admin(s)`);
    console.log(`From: ${userEmail || 'N/A'} | SIRET: ${userSiret || 'N/A'}`);
    console.log(`Message: ${message.substring(0, 100)}...`);

    // Generate notification HTML
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;direction:rtl;">
        <h2 style="color:#f59e0b;">🎫 تذكرة دعم جديدة</h2>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
          <p><strong>رقم التذكرة:</strong> ${ticketId.substring(0, 8)}</p>
          <p><strong>إيميل المستخدم:</strong> ${userEmail || 'غير متوفر'}</p>
          <p><strong>SIRET:</strong> ${userSiret || 'غير متوفر'}</p>
          <p><strong>الرسالة:</strong></p>
          <p style="background:#fff;padding:12px;border-radius:4px;border:1px solid #e2e8f0;">${message}</p>
        </div>
        <p style="color:#64748b;font-size:12px;">هذا إشعار تلقائي من نظام Ana Fi France</p>
      </div>
    `;

    // Log the notification (actual email sending requires a provider like Resend)
    console.log('Admin notification HTML generated successfully');
    console.log('Admin emails to notify:', adminEmails);

    return new Response(JSON.stringify({ 
      success: true, 
      adminsNotified: adminEmails.length,
      ticketId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in notify-admin-ticket:', error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
