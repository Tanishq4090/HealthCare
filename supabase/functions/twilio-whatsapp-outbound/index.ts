import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Approved Meta WhatsApp Template SID from Content Template Builder
const INQUIRY_TEMPLATE_SID = 'HXd2395942efa3143732f4844391e982b3';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone, message, leadName, useTemplate } = await req.json();

    if (!phone) {
      return new Response(JSON.stringify({ error: "Missing 'phone'" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || '+14782155879';
    const MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') || 'MGbe9775ea8aa459a5e88292470ee7afb6';

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: "Missing Twilio API credentials in environment." }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const digits = phone.replace(/\D/g, '');
    const formattedPhone = `whatsapp:+${digits}`;

    console.log(`[Twilio WhatsApp] Target: ${formattedPhone} | Template Mode: ${useTemplate !== false}`);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const formData = new URLSearchParams();
    formData.append('To', formattedPhone);

    if (useTemplate !== false && leadName) {
      // ✅ FINAL FIX: Using ContentSid + MessagingServiceSid (REQUIRED for Content API)
      formData.append('MessagingServiceSid', MESSAGING_SERVICE_SID);
      formData.append('ContentSid', INQUIRY_TEMPLATE_SID);
      formData.append('ContentVariables', JSON.stringify({ "1": leadName.trim() }));
      console.log(`[Twilio WhatsApp] Dispatching Content Template ${INQUIRY_TEMPLATE_SID} via Service ${MESSAGING_SERVICE_SID}`);
    } else if (message) {
      // Free-form body — using direct From number
      formData.append('From', `whatsapp:${TWILIO_WHATSAPP_NUMBER}`);
      formData.append('Body', message);
      console.log(`[Twilio WhatsApp] Sending free-form message.`);
    } else {
      return new Response(JSON.stringify({ error: "Must provide either leadName or message." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("[Twilio WhatsApp] API Error:", JSON.stringify(twilioData));
      return new Response(JSON.stringify({
        error: "Twilio API failed to send message",
        details: twilioData
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("[Twilio WhatsApp] Message Success SID:", twilioData.sid);

    return new Response(JSON.stringify({
      success: true,
      message_id: twilioData.sid,
      status: twilioData.status
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
