import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Retry helper with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 200
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const error = err as Error;
      lastError = error;
      const errorMsg = error?.message || '';
      const isRetryable = errorMsg.includes('timeout') || 
                          errorMsg.includes('connect error') ||
                          errorMsg.includes('reset');
      if (!isRetryable || attempt === maxRetries - 1) {
        throw error;
      }
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 100;
      console.log(`[validate-temp-email] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tempEmailId, token, emailIds } = await req.json();

    if (!tempEmailId && !emailIds) {
      console.error('[validate-temp-email] Missing tempEmailId or emailIds');
      return new Response(
        JSON.stringify({ valid: false, error: 'Missing tempEmailId or emailIds', code: 'MISSING_PARAMS' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Create service role client to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // If emailIds array provided, validate multiple emails at once
    if (emailIds && Array.isArray(emailIds) && emailIds.length > 0) {
      // Limit the batch size to prevent timeouts
      const limitedIds = emailIds.slice(0, 20);
      console.log(`[validate-temp-email] Validating ${limitedIds.length} emails (limited from ${emailIds.length})`);
      
      // Use retry wrapper for database query
      const { data: emails, error } = await withRetry(async () => {
        return await supabase
          .from('temp_emails')
          .select('id, address, domain_id, user_id, expires_at, is_active, created_at, secret_token')
          .in('id', limitedIds)
          .eq('is_active', true)
          .gt('expires_at', now)
          .order('created_at', { ascending: false });
      });

      if (error) {
        console.error('[validate-temp-email] Database error:', error);
        const isTimeout = error.message?.includes('timeout') || error.message?.includes('connect error');
        return new Response(
          JSON.stringify({ 
            valid: false, 
            error: 'Database error', 
            code: isTimeout ? 'DB_TIMEOUT' : 'DB_ERROR',
            retryable: isTimeout
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
        );
      }

      if (!emails || emails.length === 0) {
        console.log('[validate-temp-email] No valid emails found from provided IDs');
        return new Response(
          JSON.stringify({ valid: false, error: 'No valid emails found', code: 'NO_VALID_EMAILS' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      console.log(`[validate-temp-email] Found ${emails.length} valid emails`);
      
      // Return the most recent valid email (without exposing secret_token to client)
      const mostRecent = emails[0];
      return new Response(
        JSON.stringify({
          valid: true,
          email: {
            id: mostRecent.id,
            address: mostRecent.address,
            domain_id: mostRecent.domain_id,
            user_id: mostRecent.user_id,
            expires_at: mostRecent.expires_at,
            is_active: mostRecent.is_active,
            created_at: mostRecent.created_at,
          },
          // Return which emails are still valid (client can use this to clean up stale tokens)
          validEmailIds: emails.map(e => e.id),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Single email validation with token
    if (!token) {
      console.error('[validate-temp-email] Missing token for single email validation');
      return new Response(
        JSON.stringify({ valid: false, error: 'Missing token', code: 'MISSING_TOKEN' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[validate-temp-email] Validating single email: ${tempEmailId}`);

    // Query temp_emails with service role (bypasses RLS) with retry
    const { data: tempEmail, error } = await withRetry(async () => {
      return await supabase
        .from('temp_emails')
        .select('id, address, domain_id, user_id, expires_at, is_active, created_at, secret_token')
        .eq('id', tempEmailId)
        .single();
    });

    if (error || !tempEmail) {
      const isTimeout = error?.message?.includes('timeout') || error?.message?.includes('connect error');
      if (isTimeout) {
        console.error('[validate-temp-email] Database timeout:', error?.message);
        return new Response(
          JSON.stringify({ valid: false, error: 'Database timeout', code: 'DB_TIMEOUT', retryable: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 }
        );
      }
      console.log('[validate-temp-email] Email not found:', error?.message);
      return new Response(
        JSON.stringify({ valid: false, error: 'Email not found', code: 'EMAIL_NOT_FOUND' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Validate token
    if (tempEmail.secret_token !== token) {
      console.log('[validate-temp-email] Invalid token');
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid token', code: 'INVALID_TOKEN' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if expired
    if (new Date(tempEmail.expires_at) < new Date(now)) {
      console.log('[validate-temp-email] Email expired');
      return new Response(
        JSON.stringify({ valid: false, error: 'Email expired', code: 'EMAIL_EXPIRED' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if active
    if (!tempEmail.is_active) {
      console.log('[validate-temp-email] Email inactive');
      return new Response(
        JSON.stringify({ valid: false, error: 'Email inactive', code: 'EMAIL_INACTIVE' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('[validate-temp-email] Email validated successfully:', tempEmail.address);

    // Return validated email (without exposing secret_token to client)
    return new Response(
      JSON.stringify({
        valid: true,
        email: {
          id: tempEmail.id,
          address: tempEmail.address,
          domain_id: tempEmail.domain_id,
          user_id: tempEmail.user_id,
          expires_at: tempEmail.expires_at,
          is_active: tempEmail.is_active,
          created_at: tempEmail.created_at,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (err) {
    const error = err as Error;
    console.error('[validate-temp-email] Error:', error);
    const errorMsg = error?.message || '';
    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('connect error');
    return new Response(
      JSON.stringify({ 
        valid: false, 
        error: 'Internal server error',
        code: isTimeout ? 'DB_TIMEOUT' : 'INTERNAL_ERROR',
        retryable: isTimeout
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: isTimeout ? 503 : 500 }
    );
  }
});