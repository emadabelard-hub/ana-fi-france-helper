import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting account deletion for user: ${user.id}`);

    // Create admin client for deletions
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Delete user's files from storage
    console.log('Deleting user files from storage...');
    const { data: storageFiles, error: listError } = await supabaseAdmin.storage
      .from('company-assets')
      .list(user.id);

    if (listError) {
      console.error('Error listing storage files:', listError);
    } else if (storageFiles && storageFiles.length > 0) {
      const filePaths = storageFiles.map(file => `${user.id}/${file.name}`);
      const { error: deleteStorageError } = await supabaseAdmin.storage
        .from('company-assets')
        .remove(filePaths);
      
      if (deleteStorageError) {
        console.error('Error deleting storage files:', deleteStorageError);
      } else {
        console.log(`Deleted ${filePaths.length} files from storage`);
      }
    }

    // Step 2: Delete user's profile data
    console.log('Deleting user profile...');
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', user.id);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
      throw new Error('Failed to delete profile data');
    }

    // Step 3: Delete the user account from auth
    console.log('Deleting user account from auth...');
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error('Error deleting user:', deleteUserError);
      throw new Error('Failed to delete user account');
    }

    console.log(`Successfully deleted account for user: ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Account and all associated data have been permanently deleted' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Account deletion error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
