import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, message } = await req.json();

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "Missing 'phone' or 'message'" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
    const META_PHONE_ID = Deno.env.get('META_PHONE_ID');

    if (!META_ACCESS_TOKEN || !META_PHONE_ID) {
      return new Response(JSON.stringify({ error: "Missing Meta API credentials in environment." }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Format phone (Meta API requires digits without plus sign, eg. '917600004090')
    const toNumber = phone.replace(/\D/g, '');

    console.log(`[Meta WhatsApp] Sending message to ${toNumber}...`);

    const metaResponse = await fetch(
      `https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: toNumber,
          type: "text",
          text: {
            preview_url: false,
            body: message
          }
        }),
      }
    );

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error("[Meta WhatsApp] Error:", metaData);
      return new Response(JSON.stringify({
        error: "Meta API failed to send message",
        details: metaData
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("[Meta WhatsApp] Message sent!", metaData);

    return new Response(JSON.stringify({
      success: true,
      message_id: metaData.messages?.[0]?.id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("Internal Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
