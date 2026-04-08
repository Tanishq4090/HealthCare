import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const url = new URL(req.url);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // --- META WEBHOOK VERIFICATION (GET hub.challenge) ---
  if (req.method === 'GET' && url.searchParams.has('hub.mode')) {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    // Configured via Supabase secrets
    const META_VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN') || '99care_meta_webhook';

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
      console.log('Webhook verified successfully!');
      return new Response(challenge, { status: 200 });
    } else {
      return new Response('Forbidden', { status: 403 });
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // --- META STATUS CALLBACK / INCOMING MESSAGE (POST) ---
  if (req.method === 'POST') {
    try {
      const body = await req.json();

      // Ensure this is a Meta payload
      if (body.object === 'whatsapp_business_account' && body.entry && body.entry.length > 0) {
        const entry = body.entry[0];
        
        if (entry.changes && entry.changes.length > 0) {
          const value = entry.changes[0].value;

          // 1. WhatsApp Delivery Status Reports Context
          if (value.statuses && value.statuses.length > 0) {
            const statusObj = value.statuses[0];
            const wamid = statusObj.id;
            const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
            
            // Meta webhooks are isolated. We match by 'sid' (which stores the Meta message ID).
            const { data: existingLog } = await supabase
              .from('whatsapp_logs')
              .select('payload')
              .eq('sid', wamid)
              .single();

            const updatedPayload = existingLog?.payload 
              ? { ...existingLog.payload, statuses: value.statuses } 
              : { statuses: value.statuses };

            await supabase.from('whatsapp_logs').update({
              status: status,
              error_code: statusObj.errors ? statusObj.errors[0].code : null,
              error_message: statusObj.errors ? statusObj.errors[0].title : null,
              payload: updatedPayload
            }).eq('sid', wamid);

            console.log(`[Meta Webhook] Delivery Updated: ${wamid} -> ${status}`);
            return new Response('EVENT_RECEIVED', { status: 200 });
          }

          // 2. Incoming Messages
          if (value.messages && value.messages.length > 0) {
            // Usually, whatsapp-elevenlabs-bot handles inbound, but if Meta sends it here, just ack it.
            return new Response('EVENT_RECEIVED', { status: 200 });
          }
        }
      }
      
      // If it wasn't a Meta Webhook payload, the JSON parse might have been the CRM dispatch!
      // In that case, we MUST let it fall through to the OUTBOUND logic below.
      // So we attach the parsed body to the request object to mock reading it again.
      (req as any).crm_payload = body;
      
    } catch (e: any) {
      if (!e.message.includes('Unexpected end of JSON')) {
          console.error("Webhook processing error:", e);
      }
    }
  }

  // --- OUTBOUND: MESSAGE DISPATCH FROM CRM ---
  try {
    let payload;
    if ((req as any).crm_payload && (req as any).crm_payload.phone) {
        payload = (req as any).crm_payload;
    } else {
        // Fallback if not caught by POST webhook try/catch above
        try {
            payload = await req.json();
        } catch {
            return new Response('ok', { status: 200, headers: corsHeaders }); 
        }
    }

    if (!payload || !payload.phone) {
        // Just an empty ping or unhandled webhook structure
        return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const { phone, leadName, message, useTemplate, leadId } = payload;
    const META_SYSTEM_TOKEN = Deno.env.get('META_SYSTEM_TOKEN');
    const META_PHONE_ID = Deno.env.get('META_PHONE_ID');

    if (!META_SYSTEM_TOKEN || !META_PHONE_ID) {
        throw new Error("Missing Meta Credentials in Secrets!");
    }

    const digits = phone.replace(/\D/g, ''); // Extract just numbers (e.g. 918000044090)
    
    // Meta payload structure
    const metaBody: any = {
      "messaging_product": "whatsapp",
      "recipient_type": "individual",
      "to": digits,
    };

    if (useTemplate) {
      metaBody.type = "template";
      metaBody.template = {
        name: "hello_world",
        language: {
          code: "en_US"
        }
      };
    } else {
      metaBody.type = "text";
      metaBody.text = {
        preview_url: false,
        body: message || ''
      };
    }

    const metaUrl = `https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`;
    const metaResponse = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${META_SYSTEM_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metaBody)
    });

    const metaData = await metaResponse.json();
    
    // Log initial acceptance by Meta for tracking in CRM
    if (metaResponse.ok && metaData.messages && metaData.messages.length > 0) {
        const wamid = metaData.messages[0].id;
        await supabase.from('whatsapp_logs').insert({
            sid: wamid,
            status: 'accepted_by_meta',
            payload: { ...metaData, lead_id: leadId, original_recipient: digits }
        });
    }

    return new Response(JSON.stringify(metaData), {
      status: metaResponse.ok ? 200 : 400,
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
