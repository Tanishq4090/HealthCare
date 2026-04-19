import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify it's a POST request from ElevenLabs
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // --- Signature Verification ---
    const sigHeader = req.headers.get('elevenlabs-signature');
    const secret = Deno.env.get('ELEVENLABS_WEBHOOK_SECRET');

    if (!sigHeader || !secret) {
        console.error('Missing signature or secret');
        return new Response('Missing signature or secret', { status: 401, headers: corsHeaders });
    }

    const rawBody = await req.text();
    
    // Calculate HMAC SHA-256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify', 'sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const calculatedSignature = new TextDecoder().decode(hexEncode(new Uint8Array(signatureBuffer)));

    if (calculatedSignature !== sigHeader) {
        console.error("Signature mismatch. Given:", sigHeader, "Calculated:", calculatedSignature);
        // We reject it immediately
        return new Response('Invalid signature', { status: 401, headers: corsHeaders });
    }
    // ------------------------------

    const payload = JSON.parse(rawBody);
    console.log("ElevenLabs Webhook Payload:", JSON.stringify(payload, null, 2));

    // For post_call_transcription webhooks
    if (payload.type === 'post_call_transcription' || payload.agent_id) {
      
      const callId = payload.call_id;
      const agentId = payload.agent_id;
      const transcript = payload.transcript || []; // array of message objects
      const metadata = payload.metadata || {};
      const callDuration = payload.call_duration || 0;
      
      // 1. Format the transcript as a readable string
      const formattedTranscript = Array.isArray(transcript) 
        ? transcript.map((msg: any) => `${msg.role === 'agent' ? 'AI' : 'User'}: ${msg.message}`).join('\n')
        : (typeof transcript === 'string' ? transcript : JSON.stringify(transcript));

      // 2. Extract Data Collection (Structured Data)
      // ElevenLabs passes configured data collection in `payload.data_collection` or similar
      // The exact schema depends on the agent setup, but usually it's an array or object
      let extractedName = 'Unknown Caller';
      let extractedPhone = '';
      let extractedService = 'Inquiry';
      
      // Parse structured data if provided by ElevenLabs Data Collection
      if (payload.data_collection_results && typeof payload.data_collection_results === 'object') {
          const data = payload.data_collection_results;
          if (data.name?.value) extractedName = data.name.value;
          if (data.phone_number?.value) extractedPhone = data.phone_number.value;
          if (data.whatsapp?.value) extractedPhone = data.whatsapp.value;
          if (data.service_type?.value) extractedService = data.service_type.value;
      }

      // Fallback: try to grab phone from metadata
      if (!extractedPhone && metadata?.phone_number) extractedPhone = metadata.phone_number;
      if (!extractedPhone && metadata?.caller_id) extractedPhone = metadata.caller_id;
      
      const last10 = extractedPhone.replace(/\D/g, '').slice(-10);
      console.log(`[Webhook] Extracted name=${extractedName}, phone=${extractedPhone}, last10=${last10}`);
      
      let summary = payload.summary || `Extracted Data: ${JSON.stringify(payload.data_collection_results || {})}`;

      // 3. ROBUST LEAD UPSERT — always create/find a lead using last-10-digit matching
      let leadId = null;

      if (last10.length === 10) {
          // Robust search: match any format with the same last 10 digits
          const { data: existingLeads } = await supabaseClient
            .from('crm_leads')
            .select('id, name, pipeline_stage')
            .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`)
            .order('created_at', { ascending: false })
            .limit(1);

          if (existingLeads && existingLeads.length > 0) {
              leadId = existingLeads[0].id;
              console.log(`[Webhook] Found existing lead: ${leadId} (${existingLeads[0].name})`);
              // Update their call timestamp
              await supabaseClient.from('crm_leads')
                .update({ last_called_at: new Date().toISOString() })
                .eq('id', leadId);
          } else {
              // Auto-create a new lead from the call
              console.log(`[Webhook] No lead found. Auto-creating for ${extractedPhone}`);
              const { data: newLead, error: leadError } = await supabaseClient
                .from('crm_leads')
                .insert([{
                  name: extractedName !== 'Unknown Caller' ? extractedName : 'Unknown Caller',
                  phone: extractedPhone || `+91${last10}`,
                  whatsapp_number: extractedPhone || `+91${last10}`,
                  source: 'AI Phone Call',
                  pipeline_stage: 'New Inquiry',
                  status: 'new'
                }])
                .select('id')
                .single();

              if (!leadError && newLead) {
                  leadId = newLead.id;
                  console.log(`[Webhook] Auto-created lead: ${leadId}`);
              } else {
                  console.error('[Webhook] Error auto-creating lead:', leadError);
              }
          }
      }

      // 4. Insert Call Log into new crm_call_logs table
      const { error: logError } = await supabaseClient
        .from('crm_call_logs')
        .insert([{
           call_id: callId,
           lead_id: leadId,
           phone_number: extractedPhone,
           duration_seconds: callDuration,
           intent: extractedService,
           summary: summary,
           transcript: formattedTranscript
        }]);

      if (logError) {
          console.error("Error inserting call log:", logError);
      }

      // --- 5. DISPATCH AUTOMATED WHATSAPP GREETING ---
      const purePhone = extractedPhone.replace(/\D/g, '') || last10;
      if (purePhone && purePhone.length >= 10) {
          console.log(`[Webhook] Triggering post-call greeting for ${purePhone}`);
          
          // Detect Service from transcript if not directly collected
          let finalService = (extractedService && extractedService !== 'Inquiry') ? extractedService : 'Home Healthcare';
          let finalShift = 'General';
          const tLow = formattedTranscript.toLowerCase();
          
          if (finalService === 'Home Healthcare') {
              if (tLow.includes('baby') || tLow.includes('child') || tLow.includes('baccha') || tLow.includes('newborn')) finalService = 'Baby Care';
              else if (tLow.includes('old') || tLow.includes('parent') || tLow.includes('elderly') || tLow.includes('mother') || tLow.includes('father') || tLow.includes('dadi') || tLow.includes('dada')) finalService = 'Old Age Care';
              else if (tLow.includes('nurse') || tLow.includes('nursing') || tLow.includes('injection') || tLow.includes('patient')) finalService = 'Nursing Care';
              else if (tLow.includes('physio') || tLow.includes('therapy') || tLow.includes('rehab')) finalService = 'Physiotherapy';
          }
          if (tLow.includes('24') || tLow.includes('stay') || tLow.includes('day and night')) finalShift = '24-Hour';
          else if (tLow.includes('10') || tLow.includes('day shift')) finalShift = '10-Hour';

          const firstName = (extractedName && extractedName !== 'Unknown Caller') ? extractedName.split(' ')[0] : 'there';

          try {
              const { data: outData, error: outError } = await supabaseClient.functions.invoke('meta-whatsapp-outbound', {
                  body: {
                      phone: purePhone,
                      useTemplate: true,
                      templateName: "post_call_intake",
                      templateParams: [firstName, finalService, finalShift]
                  }
              });

              if (outError) {
                  const errorMsg = `Greeting trigger failed: ${outError.message || 'Unknown error'}`;
                  console.error(`[Webhook] ${errorMsg}`);
                  // Update call log with error
                  await supabaseClient.from('crm_call_logs')
                    .update({ automation_error: errorMsg })
                    .eq('call_id', callId);
                  
                  // Log failure so it shows in CRM audit trail
                  await supabaseClient.from('whatsapp_logs').insert([{
                      sid: `err_${Date.now()}`,
                      status: 'failed',
                      payload: { type: 'post_call_greeting_failed', error: outError.message, phone: purePhone }
                  }]);
              } else {
                  console.log(`[Webhook] Greeting dispatched successfully for ${purePhone}:`, JSON.stringify(outData).slice(0, 200));
                  await supabaseClient.from('whatsapp_messages').insert([{ 
                      phone: purePhone, 
                      role: 'assistant', 
                      content: `[Post-Call Greeting] Sent ${finalService} (${finalShift}) intake form.` 
                  }]);
              }
          } catch (invokeErr: any) {
              const errorMsg = `Invocation error: ${invokeErr.message}`;
              console.error(`[Webhook] ${errorMsg}`);
              await supabaseClient.from('crm_call_logs')
                .update({ automation_error: errorMsg })
                .eq('call_id', callId);
          }
      } else {
          console.warn(`[Webhook] No valid phone number found — skipping greeting. Extracted: "${extractedPhone}"`);
      }

      return new Response(JSON.stringify({ success: true, message: 'Call processed and greeting triggered.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else {
      // Not a post-call transcription event
      return new Response(JSON.stringify({ status: 'ignored', message: 'Not a relevant webhook event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
