import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Approved Meta WhatsApp Template Text (must match character-for-character)
const INQUIRY_TEMPLATE = (name: string) =>
  `Hi ${name}, welcome to 99 Care! We've received your inquiry. Our team is ready to provide the best healthcare staff for your home. Please share your requirements and we'll get back to you shortly!`;

serve(async (req) => {
  const { pathname } = new URL(req.url);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // LOG ALL INCOMING WEBHOOKS FROM TWILIO (Status Callbacks)
  if (pathname.includes('status')) {
    const body = await req.formData();
    const sid = body.get('MessageSid');
    const status = body.get('MessageStatus');
    const errorCode = body.get('ErrorCode');
    const errorMessage = body.get('ErrorMessage');
    
    console.log(`[Twilio Status Callback] SID: ${sid} | Status: ${status} | Error: ${errorCode} - ${errorMessage}`);
    return new Response('ok', { status: 200 });
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

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: "Missing Twilio credentials." }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const digits = phone.replace(/\D/g, '');
    const formattedPhone = `whatsapp:+${digits}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const formData = new URLSearchParams();
    formData.append('To', formattedPhone);
    formData.append('From', `whatsapp:${TWILIO_WHATSAPP_NUMBER}`); // No service, matching the successful "Read" log
    
    // Status Callback to this same function to catch "Undelivered" reasons
    const functionUrl = req.url.split('?')[0]; // Current URL
    formData.append('StatusCallback', `${functionUrl}/status`);

    if (useTemplate !== false && leadName) {
      // ✅ Using direct Body matching (matches the successful MM... success path)
      const bodyText = INQUIRY_TEMPLATE(leadName.trim());
      formData.append('Body', bodyText);
      console.log(`[Twilio WhatsApp] Dispatching Template Body to ${formattedPhone}`);
    } else {
      formData.append('Body', message || '');
      console.log(`[Twilio WhatsApp] Dispatching Free-form Body.`);
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
        console.error("[Twilio WhatsApp] Request Failed:", twilioData);
        return new Response(JSON.stringify({ error: "Request Failed", details: twilioData }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    console.log("[Twilio WhatsApp] Message Enqueued. SID:", twilioData.sid);

    return new Response(JSON.stringify({
      success: true,
      sid: twilioData.sid,
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
