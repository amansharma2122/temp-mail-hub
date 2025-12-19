import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendVerificationRequest {
  userId: string;
  email: string;
  name?: string;
  token: string;
}

interface MailboxConfig {
  mailbox_id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, name, token }: SendVerificationRequest = await req.json();

    console.log(`[send-verification-email] Sending verification to ${email}`);

    if (!email || !token || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch general settings for site name
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'general_settings')
      .single();

    const siteName = settingsData?.value?.siteName || 'Nullsto Temp Mail';
    const siteUrl = settingsData?.value?.siteUrl || 'https://nullsto.com';

    // Build verification link
    const verifyLink = `${siteUrl}/verify-email?token=${token}`;

    // Get SMTP settings from mailbox load balancer
    let mailboxConfig: MailboxConfig | null = null;
    let host: string | undefined;
    let port: number = 587;
    let username: string | undefined;
    let password: string | undefined;
    let fromAddress: string | undefined;

    // Try to get mailbox from database using load balancer
    const { data: mailboxData, error: mailboxError } = await supabase.rpc('select_available_mailbox');
    
    if (!mailboxError && mailboxData && mailboxData.length > 0) {
      mailboxConfig = mailboxData[0] as MailboxConfig;
      host = mailboxConfig.smtp_host;
      port = mailboxConfig.smtp_port;
      username = mailboxConfig.smtp_user;
      password = mailboxConfig.smtp_password;
      fromAddress = mailboxConfig.smtp_from || username;
      console.log(`[send-verification-email] Using mailbox: ${mailboxConfig.mailbox_id}`);
    } else {
      // Fallback to environment variables
      console.log('[send-verification-email] No mailbox available, falling back to env vars');
      host = Deno.env.get("SMTP_HOST");
      port = parseInt(Deno.env.get("SMTP_PORT") || "587");
      username = Deno.env.get("SMTP_USER");
      password = Deno.env.get("SMTP_PASSWORD");
      fromAddress = Deno.env.get("SMTP_FROM") || username;
    }

    if (!host || !username || !password) {
      console.error('[send-verification-email] Missing SMTP configuration');
      return new Response(
        JSON.stringify({ success: false, error: "SMTP configuration incomplete. Please configure a mailbox in Admin > Mailboxes." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-verification-email] Sending via ${host}:${port}`);

    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const client = new SMTPClient({
      connection: {
        hostname: host,
        port: port,
        tls: port === 465,
        auth: {
          username: username,
          password: password,
        },
      },
    });

    const htmlBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f4f4f5; }
            .container { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 40px 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { padding: 40px 30px; }
            .content h2 { color: #0d9488; margin-top: 0; }
            .button { display: inline-block; background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
            .button:hover { opacity: 0.9; }
            .footer { text-align: center; padding: 20px 30px; color: #64748b; font-size: 12px; background: #f8fafc; }
            .link-text { word-break: break-all; font-size: 12px; color: #64748b; margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${siteName}</h1>
            </div>
            <div class="content">
              <h2>Verify Your Email Address</h2>
              <p>Hi ${name || 'there'},</p>
              <p>Thank you for signing up for ${siteName}! To complete your registration and access all features, please verify your email address by clicking the button below:</p>
              <div style="text-align: center;">
                <a href="${verifyLink}" class="button">Verify Email Address</a>
              </div>
              <p>This verification link will expire in 24 hours.</p>
              <p>If you didn't create an account with us, you can safely ignore this email.</p>
              <div class="link-text">
                <strong>Can't click the button?</strong> Copy and paste this link into your browser:<br>
                ${verifyLink}
              </div>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
              <p>This email was sent to ${email}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      await client.send({
        from: `${siteName} <${fromAddress}>`,
        to: email,
        subject: `Verify your email address - ${siteName}`,
        html: htmlBody,
      });

      await client.close();

      // Increment mailbox usage if using database mailbox
      if (mailboxConfig) {
        await supabase.rpc('increment_mailbox_usage', { p_mailbox_id: mailboxConfig.mailbox_id });
      }

      console.log(`[send-verification-email] Email sent successfully to ${email}`);

      return new Response(
        JSON.stringify({ success: true, message: "Verification email sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (sendError: any) {
      // Record error if using database mailbox
      if (mailboxConfig) {
        await supabase.rpc('record_mailbox_error', { 
          p_mailbox_id: mailboxConfig.mailbox_id, 
          p_error: sendError.message 
        });
      }
      throw sendError;
    }

  } catch (error: any) {
    console.error("[send-verification-email] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
