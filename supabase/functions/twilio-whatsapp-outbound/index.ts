import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Approved Meta WhatsApp Template Text
const INQUIRY_TEMPLATE = (name: string) =>
  `Hi ${name}, welcome to 99 Care! We've received your inquiry. Our team is ready to provide the best healthcare staff for your home. Please share your requirements and we'll get back to you shortly!`;

// Simple in-memory log buffer for diagnostics (RESET ON DEPLOY/IDLE)
const LOG_BUFFER: any[] = [];

serve(async (req) => {
  const url = new URL(req.url);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // --- DIAGNOSTIC ENDPOINT ---
  if (url.searchParams.get('get_logs') === 'true') {
    return new Response(JSON.stringify(LOG_BUFFER), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // --- STATUS CALLBACK HANDLER ---
  if (url.pathname.endsWith('/status')) {
    const formData = await req.formData();
    const result = {
        timestamp: new Date().toISOString(),
        sid: formData.get('MessageSid'),
        status: formData.get('MessageStatus'),
        errorCode: formData.get('ErrorCode'),
        errorMessage: formData.get('ErrorMessage'),
    };
    
    LOG_BUFFER.unshift(result);
    if (LOG_BUFFER.length > 20) LOG_BUFFER.pop();
    
    console.log(`[Twilio Status] ${result.sid}: ${result.status} | Error: ${result.errorCode}`);
    return new Response('ok', { status: 200 });
  }

  // --- OUTBOUND MESSAGE HANDLER ---
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
    formData.append('From', `whatsapp:${TWILIO_WHATSAPP_NUMBER}`);
    
    // Status Callback to itself
    const callbackUrl = `${url.origin}${url.pathname}/status`;
    formData.append('StatusCallback', callbackUrl);

    if (useTemplate !== false && leadName) {
      const bodyText = INQUIRY_TEMPLATE(leadName.trim());
      formData.append('Body', bodyText);
    } else {
      formData.append('Body', message || '');
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
    return new Response(JSON.stringify(twilioData), {
      status: twilioResponse.ok ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
