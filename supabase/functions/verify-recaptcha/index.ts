import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyRequest {
  token: string;
  action: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token, action }: VerifyRequest = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "No token provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get captcha settings from database
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'captcha_settings')
      .maybeSingle();

    if (!settingsData?.value) {
      // Captcha not configured, allow through
      console.log('Captcha not configured, allowing request');
      return new Response(
        JSON.stringify({ success: true, score: 1.0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settings = settingsData.value as {
      enabled: boolean;
      provider: string;
      secretKey: string;
      threshold: number;
    };

    if (!settings.enabled) {
      console.log('Captcha disabled, allowing request');
      return new Response(
        JSON.stringify({ success: true, score: 1.0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.secretKey) {
      console.error('Captcha enabled but no secret key configured');
      return new Response(
        JSON.stringify({ success: false, error: "Captcha misconfigured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify with Google reCAPTCHA
    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(settings.secretKey)}&response=${encodeURIComponent(token)}`,
    });

    const verifyData = await verifyResponse.json();
    
    console.log('reCAPTCHA verification result:', {
      success: verifyData.success,
      score: verifyData.score,
      action: verifyData.action,
      expectedAction: action,
      threshold: settings.threshold,
    });

    if (!verifyData.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "reCAPTCHA verification failed",
          errors: verifyData['error-codes'],
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check score threshold
    const score = verifyData.score || 0;
    const threshold = settings.threshold || 0.5;
    
    if (score < threshold) {
      console.log(`reCAPTCHA score ${score} below threshold ${threshold}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Suspicious activity detected",
          score,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify action matches
    if (action && verifyData.action !== action) {
      console.warn(`Action mismatch: expected ${action}, got ${verifyData.action}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        score,
        action: verifyData.action,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error verifying reCAPTCHA:", error);
    const message = error instanceof Error ? error.message : "Verification failed";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
