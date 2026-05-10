// Edge Function: purge user_activity_logs older than 12 months (RGPD retention)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 12);

    const { error, count } = await supabase
      .from('user_activity_logs')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString());

    if (error) throw error;

    console.log(`[purge-activity-logs] deleted ${count ?? 0} rows older than ${cutoff.toISOString()}`);

    return new Response(
      JSON.stringify({ success: true, deleted: count ?? 0, cutoff: cutoff.toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[purge-activity-logs] error:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
