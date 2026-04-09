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
    let limit = 30;
    let payload: any = {};
    if (req.method === 'POST') {
      try {
        const text = await req.text();
        if (text) {
          payload = JSON.parse(text);
          if (payload.limit) limit = Math.min(100, Math.max(1, payload.limit));
        }
      } catch (e) {
        console.error("JSON parse error:", e);
      }
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

    // --- VOBIZ CDR LOOKUP: Fetch recent inbound calls to match caller phone numbers by timestamp ---
    const VOBIZ_AUTH_ID = Deno.env.get('VOBIZ_AUTH_ID');
    const VOBIZ_AUTH_TOKEN = Deno.env.get('VOBIZ_AUTH_TOKEN');
    const vobizCallerMap: Record<string, string> = {}; // startTimeISO → from_number

    if (VOBIZ_AUTH_ID && VOBIZ_AUTH_TOKEN) {
        try {
            const today = new Date();
            const yesterday = new Date(Date.now() - 48 * 60 * 60 * 1000);
            const startDate = yesterday.toISOString().slice(0, 10);
            const endDate = today.toISOString().slice(0, 10);

            const cdrRes = await fetch(
                `https://api.vobiz.ai/api/v1/account/${VOBIZ_AUTH_ID}/cdr/recent?limit=50`,
                { headers: { 'X-Auth-ID': VOBIZ_AUTH_ID, 'X-Auth-Token': VOBIZ_AUTH_TOKEN, 'Accept': 'application/json' } }
            );
            if (cdrRes.ok) {
                const cdrData = await cdrRes.json();
                const records = cdrData.data || [];
                // Build a map: for each CDR record, key = start_time rounded to 10s, value = caller phone
                for (const rec of records) {
                    if (rec.call_direction === 'inbound' && rec.caller_id_number && rec.start_time) {
                        const t = new Date(rec.start_time).getTime();
                        // Store under multiple keys (every 10 seconds within ±60s) for fuzzy matching
                        for (let offset = -60000; offset <= 60000; offset += 10000) {
                            const key = Math.floor((t + offset) / 10000).toString();
                            if (!vobizCallerMap[key]) vobizCallerMap[key] = rec.caller_id_number;
                        }
                    }
                }
                console.log(`[Vobiz CDR] Loaded ${records.length} CDR records, built ${Object.keys(vobizCallerMap).length} time keys`);
            } else {
                console.warn('[Vobiz CDR] Failed to fetch CDRs:', cdrRes.status, cdrRes.statusText);
            }
        } catch (e: any) {
            console.error('[Vobiz CDR] Exception:', e.message);
        }
    }

    // Initialize Supabase with Service Role to check which calls are already 'Processed' in CRM Pipeline
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch which conversation_ids have ALREADY been explicitly added to the CRM pipeline
    // Only mark a call as 'Processed' if its specific conversation_id has a lead_id in call_transcripts
    const { data: processedTranscripts } = await supabaseClient
        .from('call_transcripts')
        .select('conversation_id')
        .not('lead_id', 'is', null);
    const processedConversationIds = new Set(
        (processedTranscripts || []).map((t: any) => t.conversation_id).filter(Boolean)
    );

    // Format calls for CRM Dashboard
    const formattedLogs = detailedCalls.filter(Boolean).map((c: any) => {
        let capturedName = null;
        let capturedPhone = null;
        let intent = c.metadata?.call_summary_title || "Inquiry";
        const transcriptStr = (c.transcript || []).map((t: any) => `${t.role === 'agent' ? 'AI' : 'User'}: ${t.message}`).join('\n');
        const summaryStr = c.analysis?.transcript_summary || c.metadata?.call_summary_title || "Call completed.";
        const duration = c.metadata?.call_duration_secs || 0;

        // Layer 1: ElevenLabs structured data collection
        if (c.analysis && c.analysis.data_collection_results) {
            const dc = c.analysis.data_collection_results;
            capturedName = dc.customer_name?.value || dc.name?.value || null;
            capturedPhone = dc.contact_number?.value || dc.phone_number?.value || dc.whatsapp?.value || null;
            if (dc.service_of_interest?.value) intent = dc.service_of_interest.value;
            else if (dc.service_type?.value) intent = dc.service_type.value;
        }

        // Layer 1b: Transcript-based Name Extraction with Intelligent Cleaning
        if (!capturedName && c.transcript && c.transcript.length > 0) {
            // Helper: strip spoken fillers ("Uh", "Aa", "Hmm", "Um") and extract clean name
            const cleanName = (raw: string): string | null => {
                // Pattern: "mera naam X hai" or "mera shubh naam X hai"
                const naaamPatterns = [
                    /mera(?:\s+shubh)?\s+naam\s+(.+?)(?:\s+hai\.?)?$/i,
                    /my name is\s+(.+?)\.?$/i,
                ];
                for (const pattern of naaamPatterns) {
                    const m = raw.match(pattern);
                    if (m) return m[1].replace(/[.,!?]+$/, '').trim();
                }
                // Strip common spoken fillers at beginning: "Uh, Tanishq." → "Tanishq"
                const fillers = /^(?:uh[\s,-]+|aa[\s,-]+|hmm[\s,-]+|um[\s,-]+|oh[\s,-]+|ah[\s,-]+|acha[\s,-]+|accha[\s,-]+)+/i;
                const stripped = raw.replace(fillers, '').replace(/[.,!?]+$/, '').trim();
                // Accept if it looks like a name (1-3 words, short)
                const words = stripped.split(/\s+/).filter(Boolean);
                if (words.length >= 1 && words.length <= 3 && stripped.length < 35) {
                    return stripped;
                }
                return null;
            };

            for (let i = 0; i < c.transcript.length; i++) {
                const turn = c.transcript[i];
                const msg = (turn.message || '').toLowerCase();
                if (turn.role === 'agent' && (msg.includes('naam') || msg.includes('your name') || msg.includes('aapka naam') || msg.includes('aapka shubh'))) {
                    if (i + 1 < c.transcript.length && c.transcript[i + 1].role === 'user') {
                        const raw = (c.transcript[i + 1].message || '').trim();
                        const cleaned = cleanName(raw);
                        if (cleaned) { capturedName = cleaned; break; }
                    }
                }
            }
        }

        // Layer 2: Metadata phone_number (set by ElevenLabs for actual phone/SIP calls)
        if (!capturedPhone && c.metadata?.phone_number) {
            capturedPhone = c.metadata.phone_number;
        }

        // Layer 2.5: Vobiz CDR Timestamp Cross-Reference
        // Match this ElevenLabs call's start time against Vobiz CDR records to get real caller phone
        if (!capturedPhone && Object.keys(vobizCallerMap).length > 0) {
            const callStartMs = c.metadata?.start_time_unix_secs
                ? c.metadata.start_time_unix_secs * 1000
                : null;
            if (callStartMs) {
                const key = Math.floor(callStartMs / 10000).toString();
                if (vobizCallerMap[key]) {
                    capturedPhone = vobizCallerMap[key];
                    console.log(`[Vobiz CDR] Matched caller: ${capturedPhone} for call at ${new Date(callStartMs).toISOString()}`);
                }
            }
        }

        // Layer 3: Dynamic wildcard SIP Header parsing
        let metadataPhone = capturedPhone || c.metadata?.phone_number || c.metadata?.caller_id || null;
        if (!metadataPhone && c.metadata) {
            for (const key in c.metadata) {
                if (typeof c.metadata[key] === 'string') {
                    const match = c.metadata[key].replace(/\D/g, '').match(/(?:91)?([6-9]\d{9})/);
                    if (match) {
                        metadataPhone = '+91' + match[1];
                        break;
                    }
                }
            }
        }

        // Layer 4: Scan transcript for Boolean confirmations to WhatsApp query (English/Hinglish/Hindi natively)
        if (!capturedPhone && c.transcript && c.transcript.length > 0) {
            for (let i = 0; i < c.transcript.length; i++) {
                const turn = c.transcript[i];
                const msg = turn.message?.toLowerCase() || '';

                if (turn.role === 'agent' && msg.includes('whatsapp')) {
                    // Check user's next reply
                    if (i + 1 < c.transcript.length && c.transcript[i+1].role === 'user') {
                        const userReply = c.transcript[i+1].message?.toLowerCase() || '';
                        if (['yes', 'haan', 'ji', 'yep', 'hanji', 'ha', 'same', 'yup', 'हाँ', 'जी', 'हां'].some(word => userReply.includes(word))) {
                            // Use real metadata phone if available; otherwise leave null (cannot know number without SIP CallerID)
                            capturedPhone = metadataPhone || null;
                        }
                    }
                }
            }
        }

        // Layer 5: Scan user (Lead) lines in transcript for dictated Indian mobile numbers
        if (!capturedPhone && c.transcript) {
            const userLines = (c.transcript as any[])
                .filter((t: any) => t.role === 'user')
                .map((t: any) => t.message || '')
                .join(' ');
            const phoneMatches = userLines.match(/(?:\+?91[\s\-]?)?([6-9]\d{9})/g);
            if (phoneMatches && phoneMatches.length > 0) {
                // Take last confirmed match (user typically confirms at end of call)
                capturedPhone = phoneMatches[phoneMatches.length - 1].replace(/[\s\-]/g, '');
                // Normalize to +91 format
                if (capturedPhone.length === 10) capturedPhone = '+91' + capturedPhone;
            }
        }

        // Layer 6: Fallback — scan summary text
        if (!capturedPhone && summaryStr) {
            const phoneMatch = summaryStr.match(/(?:\+?91[\s\-]?)?([6-9]\d{9})/);
            if (phoneMatch) capturedPhone = (phoneMatch[1].length === 10 ? '+91' : '') + phoneMatch[1].replace(/[\s\-]/g, '');
        }

        // Name fallback from summary
        if (!capturedName && summaryStr) {
            const nameMatch = summaryStr.match(/The user,? ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/);
            if (nameMatch) capturedName = nameMatch[1].trim();
        }

        // A call is only 'Processed' if it was EXPLICITLY added to the pipeline via the button
        const isProcessed = processedConversationIds.has(c.conversation_id);

        return {
           id: c.conversation_id,
           created_at: new Date(c.metadata?.start_time_unix_secs ? c.metadata.start_time_unix_secs * 1000 : Date.now()).toISOString(),
           duration_seconds: duration,
           intent: intent,
           summary: summaryStr,
           transcript: transcriptStr,
           recording_url: null,
           phone_number: capturedPhone || null,
           capturedName: capturedName,
           capturedWhatsapp: capturedPhone || null,
           lead_id: isProcessed ? 'processed' : null
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
