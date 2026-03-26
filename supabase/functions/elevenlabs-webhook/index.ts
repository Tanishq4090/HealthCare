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
          
          // These keys should match your Data Collection Variable IDs in the ElevenLabs dashboard
          if (data.name?.value) extractedName = data.name.value;
          if (data.phone_number?.value) extractedPhone = data.phone_number.value;
          if (data.whatsapp?.value) extractedPhone = data.whatsapp.value;
          if (data.service_type?.value) extractedService = data.service_type.value;
      }
      
      let summary = payload.summary || `Extracted Data: ${JSON.stringify(payload.data_collection_results || {})}`;

      // 3. Insert Lead if meaningful data was captured
      let leadId = null;
      
      // We only insert if we got at least a phone number or name, otherwise it might be a silent/dropped call
      if (extractedPhone || extractedName !== 'Unknown Caller') {
          // Check if lead already exists based on phone
          const { data: existingLeads } = await supabaseClient
            .from('crm_leads')
            .select('id')
            .eq('phone', extractedPhone)
            .limit(1);

          if (existingLeads && existingLeads.length > 0) {
              leadId = existingLeads[0].id;
              // Optionally update the existing lead's status/stage if needed
          } else {
              // Create new lead
              const { data: newLead, error: leadError } = await supabaseClient
                .from('crm_leads')
                .insert([{
                  name: extractedName,
                  phone: extractedPhone,
                  whatsapp_number: extractedPhone,
                  source: 'AI Phone Call',
                  pipeline_stage: 'New Inquiry',
                  status: 'Processed'
                }])
                .select('id')
                .single();

              if (!leadError && newLead) {
                  leadId = newLead.id;
              } else {
                  console.error("Error creating lead:", leadError);
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

      return new Response(JSON.stringify({ success: true, message: 'Call processed and lead captured.' }), {
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
