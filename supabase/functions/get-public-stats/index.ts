import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'public, max-age=60', // Cache for 1 minute
};

// IST timezone offset: UTC+5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Get midnight IST as UTC timestamp
function getMidnightIST(): string {
  const now = new Date();
  // Convert current time to IST
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  // Get midnight IST (start of day)
  const istMidnight = new Date(istNow);
  istMidnight.setUTCHours(0, 0, 0, 0);
  // Convert back to UTC
  const utcMidnight = new Date(istMidnight.getTime() - IST_OFFSET_MS);
  return utcMidnight.toISOString();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get IST midnight for "Today (IST)" stat
    const istMidnight = getMidnightIST();
    console.log('[get-public-stats] IST midnight (UTC):', istMidnight);

    // Compute today IST date string (YYYY-MM-DD) for daily counter freshness check
    const istNow = new Date(Date.now() + IST_OFFSET_MS);
    const istTodayStr = istNow.toISOString().slice(0, 10);

    // Fetch all monotonic counters from email_stats plus live counts for active/domains
    const [
      statsRowsResult,
      activeAddressesResult,
      totalDomainsResult,
    ] = await Promise.all([
      supabase
        .from('email_stats')
        .select('stat_key, stat_value, stat_date')
        .in('stat_key', [
          'total_emails_generated',
          'total_inboxes_created',
          'total_emails_received',
          'emails_today_ist',
        ]),
      supabase
        .from('temp_emails')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase
        .from('domains')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
    ]);

    const statMap = new Map<string, { value: number; date: string | null }>();
    for (const row of statsRowsResult.data ?? []) {
      statMap.set(row.stat_key, {
        value: Number(row.stat_value ?? 0),
        date: (row as { stat_date?: string | null }).stat_date ?? null,
      });
    }

    const todayRow = statMap.get('emails_today_ist');
    // Auto-reset display if stored date is stale (trigger will reset on next insert)
    const emailsToday = todayRow && todayRow.date === istTodayStr ? todayRow.value : 0;
    const totalEmailsReceived = statMap.get('total_emails_received')?.value ?? 0;
    const totalInboxesCreated = statMap.get('total_inboxes_created')?.value ?? 0;
    const totalEmailsGenerated = statMap.get('total_emails_generated')?.value ?? 0;
    const activeAddresses = activeAddressesResult.count ?? 0;
    const activeDomains = totalDomainsResult.count ?? 0;

    const stats = {
      // Emails since midnight IST - resets at IST midnight
      emailsToday: emailsToday,
      // All-time received emails (monotonic)
      totalEmails: totalEmailsReceived,
      // Currently active inboxes (can go down as they expire)
      activeAddresses: activeAddresses,
      // Total inboxes ever created (monotonic) - for display as "Inboxes Created"
      totalInboxesCreated: totalInboxesCreated,
      // Active domains
      activeDomains: activeDomains,
      // Permanent counter from email_stats (monotonic) - never resets
      totalEmailsGenerated: Number(totalEmailsGenerated),
      updatedAt: new Date().toISOString(),
      // Include IST info for debugging
      istMidnight: istMidnight,
    };

    console.log('[get-public-stats] Returning stats:', stats);

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-public-stats:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to fetch stats',
      // Return default stats on error
      emailsToday: 0,
      totalEmails: 0,
      activeAddresses: 0,
      totalInboxesCreated: 0,
      activeDomains: 0,
      totalEmailsGenerated: 0,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});