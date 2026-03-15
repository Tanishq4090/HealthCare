// supabase/functions/razorpay-webhook/index.ts
// Deploy: supabase functions deploy razorpay-webhook
//
// In Razorpay Dashboard → Settings → Webhooks → Add New:
//   URL: https://YOUR_PROJECT.supabase.co/functions/v1/razorpay-webhook
//   Secret: set one and store as RAZORPAY_WEBHOOK_SECRET
//   Events to subscribe:
//     payment.captured   ← client pays online
//     payment.failed     ← optional, for alerting
//
// This webhook handles both deposit payments and monthly invoice payments.
// It detects which by matching razorpay_order_id on the invoices table.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;

// ── Signature verification ────────────────────────────────────
// Razorpay signs the payload with HMAC-SHA256.
// Never process payments without verifying this.

function verifySignature(body: string, signature: string): boolean {
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  return expected === signature;
}

// ── Send WhatsApp confirmation ─────────────────────────────────

async function sendWhatsApp(to: string, message: string, leadId?: string, clientId?: string) {
  const WHATSAPP_API_URL = "https://api.twilio.com/2010-04-01/Accounts/" +
    Deno.env.get("TWILIO_ACCOUNT_SID") + "/Messages.json";

  const params = new URLSearchParams({
    From: `whatsapp:${Deno.env.get("WHATSAPP_SOURCE_NUMBER")}`,
    To:   `whatsapp:${to}`,
    Body: message,
  });

  await fetch(WHATSAPP_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:  "Basic " + btoa(
        Deno.env.get("TWILIO_ACCOUNT_SID") + ":" + Deno.env.get("TWILIO_AUTH_TOKEN")
      ),
    },
    body: params.toString(),
  });

  // Log outgoing message
  if (leadId || clientId) {
    await supabase.from("communications").insert({
      lead_id:    leadId   || null,
      client_id:  clientId || null,
      whatsapp_number: to,
      direction:  "outgoing",
      message_body: message,
      message_type: "text",
    });
  }
}

// ── Main webhook handler ──────────────────────────────────────

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  const body      = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  // ── Always verify signature first ──
  if (!verifySignature(body, signature)) {
    console.error("Invalid Razorpay signature — rejecting");
    return new Response("unauthorized", { status: 401 });
  }

  const event = JSON.parse(body);
  const eventType = event.event;  // "payment.captured" | "payment.failed" etc.

  if (eventType === "payment.captured") {
    const payment   = event.payload.payment.entity;
    const orderId   = payment.order_id;   // matches invoices.razorpay_order_id
    const paymentId = payment.id;         // razorpay payment ID
    const amount    = payment.amount / 100;  // Razorpay sends paise, convert to ₹
    const mode      = payment.method;     // "upi", "card", "netbanking" etc.

    // ── Find the invoice this payment is for ──
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, invoice_number, invoice_type, client_id, net_amount, status")
      .eq("razorpay_order_id", orderId)
      .maybeSingle();

    if (!invoice) {
      // Could be a deposit where order_id was stored on the lead instead
      // Try matching via leads table
      const { data: lead } = await supabase
        .from("leads")
        .select("id, name, whatsapp_number, converted_client_id")
        .eq("razorpay_order_id", orderId)
        .maybeSingle();

      if (lead?.converted_client_id) {
        // Find deposit invoice for this client
        const { data: depInvoice } = await supabase
          .from("invoices")
          .select("id, invoice_number")
          .eq("client_id", lead.converted_client_id)
          .eq("invoice_type", "deposit")
          .neq("status", "paid")
          .maybeSingle();

        if (depInvoice) {
          await processPayment({
            invoiceId:    depInvoice.id,
            invoiceNumber: depInvoice.invoice_number,
            invoiceType:  "deposit",
            clientId:     lead.converted_client_id,
            leadId:       lead.id,
            whatsappNumber: lead.whatsapp_number,
            clientName:   lead.name,
            amount, paymentId, mode,
          });
        }
      }

      return new Response("ok");
    }

    // Prevent double-processing
    if (invoice.status === "paid") {
      console.log(`Invoice ${invoice.invoice_number} already marked paid — skipping`);
      return new Response("ok");
    }

    // Get client contact details
    const { data: client } = await supabase
      .from("clients")
      .select("name, whatsapp_number")
      .eq("id", invoice.client_id)
      .single();

    // Get associated lead
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("converted_client_id", invoice.client_id)
      .maybeSingle();

    await processPayment({
      invoiceId:      invoice.id,
      invoiceNumber:  invoice.invoice_number,
      invoiceType:    invoice.invoice_type,
      clientId:       invoice.client_id,
      leadId:         lead?.id,
      whatsappNumber: client?.whatsapp_number,
      clientName:     client?.name,
      amount, paymentId, mode,
    });
  }

  if (eventType === "payment.failed") {
    const payment = event.payload.payment.entity;
    console.warn("Payment failed:", payment.id, payment.error_description);
    // Could send HR an alert here if needed
  }

  return new Response("ok");
});

// ── Process a confirmed payment ───────────────────────────────

async function processPayment(p: {
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: string;
  clientId: string;
  leadId?: string;
  whatsappNumber?: string;
  clientName?: string;
  amount: number;
  paymentId: string;
  mode: string;
}) {
  const fmt = (n: number) => "₹" + n.toLocaleString("en-IN");

  // 1. Create payment record
  await supabase.from("payments").insert({
    invoice_id:          p.invoiceId,
    client_id:           p.clientId,
    amount:              p.amount,
    payment_mode:        normalizeMode(p.mode),
    razorpay_payment_id: p.paymentId,
    paid_at:             new Date().toISOString(),
    recorded_by:         "auto",
    notes:               `Razorpay ${p.mode}`,
  });

  // 2. Mark invoice as paid
  await supabase.from("invoices")
    .update({ status: "paid", razorpay_payment_id: p.paymentId })
    .eq("id", p.invoiceId);

  // 3. If deposit — advance lead status to deposit_received
  //    (status engine then fires: activates client + sends confirmation)
  if (p.invoiceType === "deposit" && p.leadId) {
    await supabase.from("clients")
      .update({ deposit_paid: true })
      .eq("id", p.clientId);

    await supabase.from("leads")
      .update({ status: "deposit_received" })
      .eq("id", p.leadId)
      .eq("status", "deposit_pending");  // only advance if still pending
  }

  // 4. Send WhatsApp confirmation to client
  if (p.whatsappNumber) {
    const typeLabel = p.invoiceType === "deposit" ? "Security deposit" : `Invoice ${p.invoiceNumber}`;
    const message =
      `✅ *Payment Received — 99 Care*\n\n` +
      `Hi ${p.clientName || "there"},\n\n` +
      `${typeLabel}: *${fmt(p.amount)}* received.\n` +
      `Payment ID: ${p.paymentId}\n` +
      `Mode: ${p.mode}\n\n` +
      (p.invoiceType === "deposit"
        ? `Your caregiver will be assigned shortly. We'll confirm the start date soon. 🙏`
        : `Thank you for the payment! 🙏`
      ) +
      `\n\n— 99 Care | +91 9016116564`;

    await sendWhatsApp(p.whatsappNumber, message, p.leadId, p.clientId);
  }
}

// ── Normalize Razorpay payment method to our enum ─────────────

function normalizeMode(method: string): string {
  const map: Record<string, string> = {
    upi: "upi", card: "upi", netbanking: "bank_transfer",
    wallet: "upi", emi: "bank_transfer", bank_transfer: "bank_transfer",
  };
  return map[method] ?? "upi";
}
