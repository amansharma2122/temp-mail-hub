import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      console.error("Stripe keys not configured");
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return new Response(
        JSON.stringify({ error: "No signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.text();
    
    // Verify webhook signature using crypto
    const encoder = new TextEncoder();
    const timestampMatch = signature.match(/t=(\d+)/);
    const signatureMatch = signature.match(/v1=([a-f0-9]+)/);
    
    if (!timestampMatch || !signatureMatch) {
      return new Response(
        JSON.stringify({ error: "Invalid signature format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const timestamp = timestampMatch[1];
    const expectedSignature = signatureMatch[1];
    const signedPayload = `${timestamp}.${body}`;
    
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(STRIPE_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedPayload)
    );
    
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    
    if (computedSignature !== expectedSignature) {
      console.error("Signature verification failed");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event = JSON.parse(body);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Processing Stripe event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const tierId = session.metadata?.tier_id;
        
        if (userId && tierId) {
          // Update subscription
          await supabase
            .from("user_subscriptions")
            .upsert({
              user_id: userId,
              tier_id: tierId,
              status: "active",
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }, { onConflict: "user_id" });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        // Find user by stripe_customer_id
        const { data: subscription } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();
        
        if (subscription) {
          await supabase.from("user_invoices").insert({
            user_id: subscription.user_id,
            stripe_invoice_id: invoice.id,
            stripe_payment_intent_id: invoice.payment_intent,
            amount_paid: invoice.amount_paid / 100,
            currency: invoice.currency,
            status: "paid",
            description: invoice.lines?.data?.[0]?.description || "Subscription payment",
            invoice_url: invoice.hosted_invoice_url,
            invoice_pdf: invoice.invoice_pdf,
            period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
            period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
            paid_at: new Date().toISOString(),
          });

          // Update subscription status
          await supabase
            .from("user_subscriptions")
            .update({ 
              status: "active",
              current_period_end: invoice.period_end 
                ? new Date(invoice.period_end * 1000).toISOString() 
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq("user_id", subscription.user_id);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        const { data: subscription } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();
        
        if (subscription) {
          await supabase
            .from("user_subscriptions")
            .update({ status: "past_due" })
            .eq("user_id", subscription.user_id);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        const { data: userSub } = await supabase
          .from("user_subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .single();
        
        if (userSub) {
          await supabase
            .from("user_subscriptions")
            .update({
              status: subscription.status === "active" ? "active" : subscription.status,
              cancel_at_period_end: subscription.cancel_at_period_end,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq("user_id", userSub.user_id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        
        const { data: userSub } = await supabase
          .from("user_subscriptions")
          .select("user_id, tier_id")
          .eq("stripe_customer_id", customerId)
          .single();
        
        if (userSub) {
          // Get free tier
          const { data: freeTier } = await supabase
            .from("subscription_tiers")
            .select("id")
            .ilike("name", "free")
            .single();
          
          if (freeTier) {
            await supabase
              .from("user_subscriptions")
              .update({
                tier_id: freeTier.id,
                status: "cancelled",
                stripe_subscription_id: null,
              })
              .eq("user_id", userSub.user_id);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});