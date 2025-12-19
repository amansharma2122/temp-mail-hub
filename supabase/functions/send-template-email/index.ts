import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendTemplateEmailRequest {
  templateId?: string;
  templateType?: string;
  recipientEmail: string;
  recipientName?: string;
  customVariables?: Record<string, string>;
}

interface MailboxConfig {
  mailbox_id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from: string;
}

// Helper to format date
const formatDate = (): string => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
};

// Helper to parse user agent
const parseUserAgent = (ua: string): string => {
  if (!ua) return 'Unknown Browser';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Opera')) return 'Opera';
  return 'Unknown Browser';
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { templateId, templateType, recipientEmail, recipientName, customVariables }: SendTemplateEmailRequest = await req.json();
    
    // Get request metadata for template variables
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     req.headers.get('x-real-ip') || 
                     'Unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const browser = parseUserAgent(userAgent);
    const currentDate = formatDate();

    console.log(`[send-template-email] Request: templateId=${templateId}, templateType=${templateType}, to=${recipientEmail}`);

    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Recipient email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!templateId && !templateType) {
      return new Response(
        JSON.stringify({ success: false, error: "Either templateId or templateType is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the template
    let templateQuery = supabase.from('email_templates').select('*');
    if (templateId) {
      templateQuery = templateQuery.eq('id', templateId);
    } else if (templateType) {
      templateQuery = templateQuery.eq('type', templateType);
    }

    const { data: templates, error: templateError } = await templateQuery.limit(1);

    if (templateError) {
      console.error('[send-template-email] Template fetch error:', templateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch template" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Template not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const template = templates[0];

    // Fetch general settings for site name
    const { data: settingsData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'general_settings')
      .single();

    const siteName = settingsData?.value?.siteName || 'Nullsto Temp Mail';
    const siteUrl = settingsData?.value?.siteUrl || 'https://nullsto.com';

    // Replace template variables
    const replaceVariables = (text: string): string => {
      let result = text
        .replace(/\{\{site_name\}\}/g, siteName)
        .replace(/\{\{site_url\}\}/g, siteUrl)
        .replace(/\{\{name\}\}/g, recipientName || 'User')
        .replace(/\{\{email\}\}/g, recipientEmail)
        .replace(/\{\{link\}\}/g, siteUrl)
        .replace(/\{\{reset_link\}\}/g, `${siteUrl}/auth?mode=reset`)
        .replace(/\{\{verify_link\}\}/g, `${siteUrl}/verify-email`)
        .replace(/\{\{date\}\}/g, currentDate)
        .replace(/\{\{ip_address\}\}/g, clientIp)
        .replace(/\{\{browser\}\}/g, browser);

      // Replace any custom variables
      if (customVariables) {
        for (const [key, value] of Object.entries(customVariables)) {
          result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }
      }

      return result;
    };

    const subject = replaceVariables(template.subject);
    const body = replaceVariables(template.body);

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
      console.log(`[send-template-email] Using mailbox: ${mailboxConfig.mailbox_id}`);
    } else {
      // Fallback to environment variables
      console.log('[send-template-email] No mailbox available, falling back to env vars');
      host = Deno.env.get("SMTP_HOST");
      port = parseInt(Deno.env.get("SMTP_PORT") || "587");
      username = Deno.env.get("SMTP_USER");
      password = Deno.env.get("SMTP_PASSWORD");
      fromAddress = Deno.env.get("SMTP_FROM") || username;
    }

    if (!host || !username || !password) {
      console.error('[send-template-email] Missing SMTP configuration');
      return new Response(
        JSON.stringify({ success: false, error: "SMTP configuration incomplete. Please configure a mailbox in Admin > Mailboxes." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-template-email] Sending "${template.name}" to ${recipientEmail} via ${host}:${port}`);

    // Send email using SMTP
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

    // Convert plain text body to HTML if it doesn't contain HTML tags
    const isHtml = /<[^>]+>/g.test(body);
    const htmlBody = isHtml ? body : `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; margin-top: 20px; color: #64748b; font-size: 12px; }
            a { color: #0d9488; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0;">${siteName}</h1>
          </div>
          <div class="content">
            ${body.split('\n').map(line => `<p>${line}</p>`).join('')}
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    try {
      await client.send({
        from: `${siteName} <${fromAddress}>`,
        to: recipientEmail,
        subject: subject,
        html: htmlBody,
      });

      await client.close();

      // Increment mailbox usage if using database mailbox
      if (mailboxConfig) {
        await supabase.rpc('increment_mailbox_usage', { p_mailbox_id: mailboxConfig.mailbox_id });
      }

      console.log(`[send-template-email] Email sent successfully to ${recipientEmail}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Email sent successfully to ${recipientEmail}`,
          template: template.name,
          subject: subject
        }),
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
    console.error("[send-template-email] Error:", error);
    
    let errorMessage = error.message || "Failed to send email";
    
    if (errorMessage.includes("Authentication") || errorMessage.includes("auth")) {
      errorMessage = "SMTP authentication failed. Check your credentials.";
    } else if (errorMessage.includes("Connection") || errorMessage.includes("connect")) {
      errorMessage = "Could not connect to SMTP server.";
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
