import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Official Template Parameters
const CONTENT_SID = 'HXd2395942efa3143732f4844391e982b3';
const SERVICE_SID = 'MGbe9775ea8aa459a5e88292470ee7afb6';

serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // --- DIAGNOSTIC: GET LOGS ---
  if (url.searchParams.get('get_logs') === 'true') {
    const { data } = await supabase.from('whatsapp_logs').select('*').order('created_at', { ascending: false }).limit(20);
    return new Response(JSON.stringify(data || []), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // --- WEBHOOK: STATUS CALLBACK ---
  if (url.searchParams.get('status') === 'true') {
    try {
      const body = await req.formData();
      await supabase.from('whatsapp_logs').upsert({
        sid: body.get('MessageSid'),
        status: body.get('MessageStatus'),
        error_code: body.get('ErrorCode'),
        error_message: body.get('ErrorMessage'),
        payload: Object.fromEntries(body.entries())
      });
    } catch (e) {
      console.error("Webhook error:", e);
    }
    return new Response('ok', { status: 200 });
  }

  // --- OUTBOUND: MAIN HANDLER ---
  try {
    const payload = await req.json();
    const { phone, leadName, useTemplate } = payload;

    // Pre-flight database entry
    await supabase.from('whatsapp_logs').insert({
      sid: `START_${Date.now()}`,
      status: 'INITIATED',
      error_message: `Number: ${phone} | Name: ${leadName}`
    });

    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || '+14782155879';

    const digits = phone.replace(/\D/g, '');
    const formattedPhone = `whatsapp:+${digits}`;

    const formData = new URLSearchParams();
    formData.append('To', formattedPhone);
    
    // Absolute production URL for status callback
    const callbackUrl = `https://sgyladamwnanudnropwl.supabase.co/functions/v1/twilio-whatsapp-outbound?status=true`;
    formData.append('StatusCallback', callbackUrl);

    if (useTemplate !== false && leadName) {
      // ✅ USING THE COMBINATION THAT WORKS WITH NEW TWILIO CONTENT BUILDER
      formData.append('MessagingServiceSid', SERVICE_SID);
      formData.append('ContentSid', CONTENT_SID);
      formData.append('ContentVariables', JSON.stringify({ "1": leadName.trim() }));
      
      // Fallback body for session-stale templates
      formData.append('Body', `Hi ${leadName.trim()}, welcome to 99 Care! We've received your inquiry. Our team is ready to provide the best healthcare staff for your home. Please share your requirements and we'll get back to you shortly!`);
      
      console.log(`[Twilio] Dispatching via Content API: ${CONTENT_SID}`);
    } else {
      formData.append('From', `whatsapp:${TWILIO_WHATSAPP_NUMBER}`);
      formData.append('Body', payload.message || '');
      console.log(`[Twilio] Dispatching free-form`);
    }

    const restUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const response = await fetch(restUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const data = await response.json();
    
    // Log initial success
    if (response.ok) {
        await supabase.from('whatsapp_logs').insert({
            sid: data.sid,
            status: 'ACCEPTED_BY_TWILIO',
            payload: data
        });
    }

    return new Response(JSON.stringify(data), {
      status: response.ok ? 200 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
