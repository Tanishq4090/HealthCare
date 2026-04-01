import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Approved Meta WhatsApp Template SID from Content Template Builder
// This SID was active during the successful MM09... delivery at 2:24 AM
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
    const MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || '+14782155879';

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return new Response(JSON.stringify({ error: "Missing Twilio API credentials in Supabase secrets." }), {
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
      // ✅ REPLICATION PATH: MM... SID generation via ContentSid + ServiceSid
      if (MESSAGING_SERVICE_SID) {
        formData.append('MessagingServiceSid', MESSAGING_SERVICE_SID);
      } else {
        formData.append('From', `whatsapp:${TWILIO_WHATSAPP_NUMBER}`);
      }
      
      formData.append('ContentSid', INQUIRY_TEMPLATE_SID);
      formData.append('ContentVariables', JSON.stringify({ "1": leadName.trim() }));
      
      // Secondary fallback body matching
      formData.append('Body', `Hi ${leadName.trim()}, welcome to 99 Care! We've received your inquiry. Our team is ready to provide the best healthcare staff for your home. Please share your requirements and we'll get back to you shortly!`);
      
      console.log(`[Twilio WhatsApp] Sending Content Template ${INQUIRY_TEMPLATE_SID} to new lead.`);
    } else {
      // Direct From + Body for free-form
      formData.append('From', `whatsapp:${TWILIO_WHATSAPP_NUMBER}`);
      formData.append('Body', message || '');
      console.log(`[Twilio WhatsApp] Sending free-form message.`);
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
      console.error("[Twilio WhatsApp] Failure:", JSON.stringify(twilioData));
      return new Response(JSON.stringify({
        error: "Twilio API failure",
        details: twilioData
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("[Twilio WhatsApp] SUCCESS SID:", twilioData.sid);

    return new Response(JSON.stringify({
      success: true,
      sid: twilioData.sid
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
