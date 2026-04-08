import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Official Production Template / Service SIDs
const CONTENT_SID = 'HXd2395942efa3143732f4844391e982b3';
const SERVICE_SID = 'MGbe9775ea8aa459a5e88292470ee7afb6';

serve(async (req) => {
  const url = new URL(req.url);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // --- WEBHOOK: STATUS CALLBACK (POST ?status=true) ---
  if (url.searchParams.get('status') === 'true') {
    try {
      const body = await req.formData();
      const sid = body.get('MessageSid');
      const status = body.get('MessageStatus');
      
      const leadId = url.searchParams.get('leadId');
      const payloadObj = Object.fromEntries(body.entries());
      if (leadId) payloadObj.lead_id = leadId;

      await supabase.from('whatsapp_logs').upsert({
        sid: sid,
        status: status,
        error_code: body.get('ErrorCode'),
        error_message: body.get('ErrorMessage'),
        payload: payloadObj
      }, { onConflict: 'sid' });
      
      console.log(`[Twilio Webhook] ${sid}: ${status}`);
    } catch (e) {
      console.error("Webhook processing error:", e);
    }
    return new Response('ok', { status: 200 });
  }

  // --- OUTBOUND: MESSAGE DISPATCH ---
  try {
    const payload = await req.json();
    const { phone, leadName, message, useTemplate } = payload;

    if (!phone) {
      return new Response(JSON.stringify({ error: "Missing 'phone'" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || '+14782155879';

    const digits = phone.replace(/\D/g, '');
    const formattedPhone = `whatsapp:+${digits}`;

    const formData = new URLSearchParams();
    formData.append('To', formattedPhone);
    
    const leadIdParam = payload.leadId ? `&leadId=${payload.leadId}` : '';
    const callbackUrl = `https://sgyladamwnanudnropwl.supabase.co/functions/v1/twilio-whatsapp-outbound?status=true${leadIdParam}`;
    formData.append('StatusCallback', callbackUrl);

    if (useTemplate !== false && leadName) {
      // ✅ Twilio Content API Pattern
      formData.append('MessagingServiceSid', SERVICE_SID);
      formData.append('ContentSid', CONTENT_SID);
      formData.append('ContentVariables', JSON.stringify({ "1": leadName.trim() }));
      
      // Secondary fallback body (required by some Meta endpoints)
      formData.append('Body', `Hi ${leadName.trim()}, welcome to 99 Care! We've received your inquiry. Our team is ready to provide the best healthcare staff for your home. Please share your requirements and we'll get back to you shortly!`);
    } else {
      formData.append('From', `whatsapp:${TWILIO_WHATSAPP_NUMBER}`);
      formData.append('Body', message || '');
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const twilioData = await twilioResponse.json();
    
    // Log the initial handoff
    if (twilioResponse.ok) {
        await supabase.from('whatsapp_logs').insert({
            sid: twilioData.sid,
            status: 'accepted_by_twilio',
            payload: { ...twilioData, lead_id: payload.leadId }
        });
    }

    return new Response(JSON.stringify(twilioData), {
      status: twilioResponse.ok ? 200 : 400,
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
