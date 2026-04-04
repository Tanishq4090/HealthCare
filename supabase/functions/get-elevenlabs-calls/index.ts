import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Determine limit from request, default to 30
    let limit = 30;
    let payload: any = {};
    try {
      payload = await req.json();
      if (payload.limit) limit = Math.min(100, Math.max(1, payload.limit));
    } catch (e) {
      // ignore JSON parse error if it's a simple GET or body is empty
    }

    // Fetch the conversation list from ElevenLabs API
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured.");

    const agentId = payload.agent_id || Deno.env.get('VITE_ELEVENLABS_AGENT_ID') || 'agent_4401kn9khqyzf68t6d99s2a8n9gt';

    const listRes = await fetch(`https://api.elevenlabs.io/v1/convai/conversations?agent_id=${agentId}`, {
        headers: { "xi-api-key": ELEVENLABS_API_KEY }
    });
    
    if (!listRes.ok) throw new Error(`ElevenLabs API List Error: ${listRes.statusText}`);
    const listData = await listRes.json();
    const topCalls = (listData.conversations || []).slice(0, limit);

    // Fetch individual call transcripts & data collection
    const detailedCalls = await Promise.all(topCalls.map(async (c: any) => {
        try {
            const detRes = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${c.conversation_id}`, {
                headers: { "xi-api-key": ELEVENLABS_API_KEY }
            });
            return await detRes.json();
        } catch (e) {
            console.error("Failed to fetch details for", c.conversation_id, e);
            return null;
        }
    }));

    // Initialize Supabase with Service Role to check which calls are already 'Processed' in CRM Pipeline
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: leads } = await supabaseClient.from('crm_leads').select('whatsapp_number, phone, name').eq('source', 'AI Phone Call');
    const processedPhones = new Set();
    if (leads) {
        leads.forEach((l: any) => {
            if (l.whatsapp_number) processedPhones.add(l.whatsapp_number);
            if (l.phone) processedPhones.add(l.phone);
        });
    }

    // Format calls for CRM Dashboard
    const formattedLogs = detailedCalls.filter(Boolean).map((c: any) => {
        let capturedName = null;
        let capturedPhone = null;
        let intent = c.metadata?.call_summary_title || "Inquiry";
        const transcriptStr = (c.transcript || []).map((t: any) => `${t.role === 'agent' ? 'AI' : 'User'}: ${t.message}`).join('\n');
        const summaryStr = c.analysis?.transcript_summary || c.metadata?.call_summary_title || "Call completed.";
        const duration = c.metadata?.call_duration_secs || 0;

        // Extract structured data if ElevenLabs Agent successfully collected it
        if (c.analysis && c.analysis.data_collection_results) {
            const dc = c.analysis.data_collection_results;
            capturedName = dc.customer_name?.value || dc.name?.value || null;
            capturedPhone = dc.contact_number?.value || dc.phone_number?.value || dc.whatsapp?.value || null;
            if (dc.service_of_interest?.value) intent = dc.service_of_interest.value;
            else if (dc.service_type?.value) intent = dc.service_type.value;
        }

        // Fallback: If Data Collection failed, try searching the transcript summary for the name/phone
        if (!capturedName && summaryStr) {
            const nameMatch = summaryStr.match(/The user, ([^,]+),/);
            if (nameMatch) capturedName = nameMatch[1].trim();
        }
        if (!capturedPhone && summaryStr) {
            const phoneMatch = summaryStr.match(/\(?(\d{8,12})\)?/);
            if (phoneMatch) capturedPhone = phoneMatch[1];
        }

        const isProcessed = capturedPhone && processedPhones.has(capturedPhone);

        return {
           id: c.conversation_id,
           created_at: new Date(c.metadata?.start_time_unix_secs ? c.metadata.start_time_unix_secs * 1000 : Date.now()).toISOString(),
           duration_seconds: duration,
           intent: intent,
           summary: summaryStr,
           transcript: transcriptStr,
           recording_url: null,
           phone_number: capturedPhone || "Unknown",
           capturedName: capturedName,
           lead_id: isProcessed ? 'processed' : null // Matches CRM logic for 'status'
        };
    });

    return new Response(JSON.stringify({ success: true, data: formattedLogs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Fetch error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
