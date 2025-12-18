import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Encryption helper functions
const ENCRYPTION_KEY = Deno.env.get('EMAIL_ENCRYPTION_KEY') || 'default-key-change-in-production';

async function getEncryptionKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('temp-email-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptText(text: string): Promise<{ encrypted: string; iv: string }> {
  if (!text) return { encrypted: '', iv: '' };
  
  const key = await getEncryptionKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(text)
  );
  
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

interface MailgunInboundEmail {
  recipient: string;
  sender: string;
  from: string;
  subject: string;
  "body-plain"?: string;
  "body-html"?: string;
  "stripped-text"?: string;
  "stripped-html"?: string;
  timestamp?: string;
  "attachment-count"?: string;
}

interface Attachment {
  filename: string;
  contentType: string;
  size: number;
  content: Uint8Array;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const contentType = req.headers.get("content-type") || "";
    let emailData: {
      recipient: string;
      sender: string;
      subject: string;
      body: string;
      htmlBody: string;
    };
    let attachments: Attachment[] = [];

    // Parse based on content type (Mailgun uses form data, SendGrid uses JSON)
    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      // Mailgun format
      const formData = await req.formData();
      const mailgunData: MailgunInboundEmail = {
        recipient: formData.get("recipient") as string || "",
        sender: formData.get("sender") as string || "",
        from: formData.get("from") as string || "",
        subject: formData.get("subject") as string || "",
        "body-plain": formData.get("body-plain") as string || "",
        "body-html": formData.get("body-html") as string || "",
        "stripped-text": formData.get("stripped-text") as string || "",
        "stripped-html": formData.get("stripped-html") as string || "",
        "attachment-count": formData.get("attachment-count") as string || "0",
      };

      emailData = {
        recipient: mailgunData.recipient.toLowerCase(),
        sender: mailgunData.from || mailgunData.sender,
        subject: mailgunData.subject || "(No Subject)",
        body: mailgunData["stripped-text"] || mailgunData["body-plain"] || "",
        htmlBody: mailgunData["stripped-html"] || mailgunData["body-html"] || "",
      };

      // Extract attachments from Mailgun
      const attachmentCount = parseInt(mailgunData["attachment-count"] || "0");
      for (let i = 1; i <= attachmentCount; i++) {
        const attachmentFile = formData.get(`attachment-${i}`) as File;
        if (attachmentFile) {
          const buffer = await attachmentFile.arrayBuffer();
          attachments.push({
            filename: attachmentFile.name,
            contentType: attachmentFile.type,
            size: attachmentFile.size,
            content: new Uint8Array(buffer),
          });
        }
      }

      console.log("Received Mailgun webhook:", { 
        recipient: emailData.recipient, 
        sender: emailData.sender, 
        subject: emailData.subject,
        attachments: attachments.length 
      });
    } else {
      // SendGrid or JSON format
      const jsonData = await req.json();
      
      // SendGrid sends an array of email objects
      const email = Array.isArray(jsonData) ? jsonData[0] : jsonData;
      
      emailData = {
        recipient: (email.to || email.envelope?.to?.[0] || "").toLowerCase(),
        sender: email.from || email.envelope?.from || "",
        subject: email.subject || "(No Subject)",
        body: email.text || "",
        htmlBody: email.html || "",
      };

      // Extract attachments from SendGrid format
      if (email.attachments && Array.isArray(email.attachments)) {
        for (const att of email.attachments) {
          if (att.content) {
            // SendGrid sends base64 encoded content
            const content = Uint8Array.from(atob(att.content), c => c.charCodeAt(0));
            attachments.push({
              filename: att.filename || "attachment",
              contentType: att.type || "application/octet-stream",
              size: content.length,
              content: content,
            });
          }
        }
      }

      console.log("Received SendGrid/JSON webhook:", { 
        recipient: emailData.recipient, 
        sender: emailData.sender, 
        subject: emailData.subject,
        attachments: attachments.length 
      });
    }

    // Find the temp email by address
    const { data: tempEmail, error: findError } = await supabase
      .from("temp_emails")
      .select("id, is_active")
      .eq("address", emailData.recipient)
      .single();

    if (findError || !tempEmail) {
      console.log("Temp email not found:", emailData.recipient);
      // Return 200 to acknowledge receipt even if email not found
      // This prevents email providers from retrying
      return new Response(JSON.stringify({ status: "ignored", reason: "recipient not found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tempEmail.is_active) {
      console.log("Temp email is inactive:", emailData.recipient);
      return new Response(JSON.stringify({ status: "ignored", reason: "recipient inactive" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Encrypt email content before storing
    console.log("Encrypting email content...");
    const [encryptedSubject, encryptedBody, encryptedHtml] = await Promise.all([
      encryptText(emailData.subject || ''),
      encryptText(emailData.body || ''),
      encryptText(emailData.htmlBody || '')
    ]);

    // Store encryption IVs for decryption
    const encryptionKeyId = `${encryptedSubject.iv}|${encryptedBody.iv}|${encryptedHtml.iv}`;

    // Insert the received email with encrypted content
    const { data: insertedEmail, error: insertError } = await supabase
      .from("received_emails")
      .insert({
        temp_email_id: tempEmail.id,
        from_address: emailData.sender,
        subject: encryptedSubject.encrypted,
        body: encryptedBody.encrypted,
        html_body: encryptedHtml.encrypted,
        is_read: false,
        is_encrypted: true,
        encryption_key_id: encryptionKeyId,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting email:", insertError);
      throw insertError;
    }

    console.log("Email saved and encrypted successfully:", insertedEmail.id);

    // Process attachments
    const savedAttachments: string[] = [];
    for (const attachment of attachments) {
      try {
        // Generate unique storage path
        const timestamp = Date.now();
        const sanitizedFilename = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${insertedEmail.id}/${timestamp}_${sanitizedFilename}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("email-attachments")
          .upload(storagePath, attachment.content, {
            contentType: attachment.contentType,
            upsert: false,
          });

        if (uploadError) {
          console.error("Error uploading attachment:", uploadError);
          continue;
        }

        // Save attachment metadata to database
        const { error: attachError } = await supabase
          .from("email_attachments")
          .insert({
            received_email_id: insertedEmail.id,
            file_name: attachment.filename,
            file_type: attachment.contentType,
            file_size: attachment.size,
            storage_path: storagePath,
          });

        if (attachError) {
          console.error("Error saving attachment metadata:", attachError);
        } else {
          savedAttachments.push(attachment.filename);
          console.log(`Attachment saved: ${attachment.filename}`);
        }
      } catch (attError) {
        console.error("Error processing attachment:", attError);
      }
    }

    return new Response(
      JSON.stringify({ 
        status: "success", 
        message: "Email received and stored",
        email_id: insertedEmail.id,
        attachments_saved: savedAttachments.length,
        attachment_names: savedAttachments
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
