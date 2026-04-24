import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse payload
    const payload = await req.json();
    const { phoneNumber, employeeName, jobTitle, shareableUrl } = payload;

    if (!phoneNumber || !employeeName || !jobTitle || !shareableUrl) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields: phoneNumber, employeeName, jobTitle, shareableUrl' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const META_SYSTEM_TOKEN = Deno.env.get('META_SYSTEM_TOKEN');
    const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID') || Deno.env.get('META_PHONE_ID');

    if (!META_SYSTEM_TOKEN || !META_PHONE_NUMBER_ID) {
      throw new Error("Missing META_SYSTEM_TOKEN or META_PHONE_NUMBER_ID in Supabase Secrets.");
    }

    // Sanitize phone number
    const digits = phoneNumber.replace(/\D/g, '');
    const to = digits.startsWith('91') ? digits : `91${digits.slice(-10)}`;

    if (to.length < 12) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid phone number — must be a valid 10-digit Indian number.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Send via WhatsApp Template: staff_assignment ───────────────
    // Template body (submit this to Meta as a Utility template):
    //
    //   "Namaste! 🙏 A care professional has been assigned to you by 99 Care.
    //
    //    👤 Name: {{1}}
    //    💼 Role: {{2}}
    //
    //    🔗 View Verified ID Card: {{3}}
    //
    //    Please verify their identity upon arrival. Link valid for 30 days.
    //    — 99 Care Team"
    //
    // Template Name: staff_assignment  |  Category: Utility
    // ─────────────────────────────────────────────────────────────

    // ── Send via WhatsApp Template: staff_assignment ───────────────
    const metaUrl = `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`;

    const templateBody = JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: 'staff_assignment',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: employeeName },
              { type: 'text', text: jobTitle },
              { type: 'text', text: shareableUrl },
            ],
          },
        ],
      },
    });

    let metaResponse = await fetch(metaUrl, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${META_SYSTEM_TOKEN}`, 'Content-Type': 'application/json' },
      body: templateBody,
    });

    // If template is still pending/not approved, fall back to free-text
    if (!metaResponse.ok) {
      console.warn(`[send-id-card-link] Template 'staff_assignment' failed — trying free-text fallback.`);
      const fallbackBody =
        `99 Care — Staff Assignment\n\n` +
        `Namaste! 🙏 A care professional has been assigned to you.\n\n` +
        `👤 Name: ${employeeName}\n` +
        `💼 Role: ${jobTitle}\n\n` +
        `🔗 View Verified ID Card:\n${shareableUrl}\n\n` +
        `Please verify their identity upon arrival. This link is valid for 30 days.\n` +
        `— 99 Care Team`;

      metaResponse = await fetch(metaUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${META_SYSTEM_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body: fallbackBody },
        }),
      });
    }

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      const detail = metaData?.error?.message ?? metaResponse.statusText;
      console.error(`[send-id-card-link] WhatsApp Error: ${detail}`);
      return new Response(JSON.stringify({ success: false, error: `WhatsApp API error: ${detail}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messageId = metaData.messages?.[0]?.id || 'unknown';
    console.log(`[send-id-card-link] Sent to ${to} — messageId: ${messageId}`);

    return new Response(JSON.stringify({ success: true, messageId }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[send-id-card-link] Internal error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
