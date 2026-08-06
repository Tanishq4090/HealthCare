import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const normalizeIndianMobile = (value: string | null | undefined) => {
    const digits = String(value || '').replace(/\D/g, '');
    const last10 = digits.slice(-10);
    return /^[6-9]\d{9}$/.test(last10) ? `+91${last10}` : '';
};

const extractIndianMobileMatches = (text: string) => {
    const matches: { phone: string; index: number }[] = [];
    const re = /\+?\d[\d\s().-]{8,16}\d/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(String(text || ''))) !== null) {
        const phone = normalizeIndianMobile(match[0]);
        if (phone) matches.push({ phone, index: match.index });
    }
    if (matches.length === 0) {
        const compact = String(text || '').replace(/\D/g, '');
        const chunkSize = compact.startsWith('91') && compact.length % 12 === 0 ? 12 : 10;
        if (compact.length >= chunkSize && compact.length % chunkSize === 0) {
            for (let index = 0; index < compact.length; index += chunkSize) {
                const phone = normalizeIndianMobile(compact.slice(index, index + chunkSize));
                if (phone) matches.push({ phone, index });
            }
        }
    }
    return matches;
};

const isWhatsappQuestion = (text: string) =>
    /whats\s*app|whatsapp|व्हाट्स\s*ऐप|व्हाट्सएप|वॉट्स\s*ऐप|वॉट्सएप/i.test(text || '');

const isPositiveWhatsappReply = (text: string) =>
    /\b(?:yes|yeah|yep|yup|same|haan|han|ha|ji|hanji|haa)\b|हाँ|हां|जी/i.test(text || '');

const isNegativeWhatsappReply = (text: string) =>
    /\b(?:no|nope|nah|nahi|nahin|nai|wrong|incorrect|galat|alag|different)\b|नहीं|नही|गलत/i.test(text || '');

const correctionCueIndex = (text: string) => {
    const match = String(text || '').search(/\b(?:no|nope|nah|nahi|nahin|nai|wrong|incorrect|galat|wait|ruk|rukiye|correct|sahi)\b|नहीं|नही|गलत|रुक|सही/i);
    return match >= 0 ? match : -1;
};

function resolveWhatsappNumber(
    transcript: any[],
    callerPhone: string | null,
    metadataPhone: string | null,
    dataCollectionPhone: string | null
) {
    const callerWhatsapp = normalizeIndianMobile(metadataPhone || callerPhone);
    const structuredWhatsapp = normalizeIndianMobile(dataCollectionPhone);
    let resolved = '';
    let askedWhatsapp = false;
    let waitingForDifferentNumber = false;
    let structuredRejected = false;

    for (let i = 0; i < transcript.length; i++) {
        const turn = transcript[i];
        const msg = String(turn?.message || '');
        const msgLower = msg.toLowerCase();

        if (turn?.role === 'agent' && isWhatsappQuestion(msgLower)) {
            askedWhatsapp = true;
            waitingForDifferentNumber = false;
            continue;
        }

        if (turn?.role !== 'user') continue;

        const phoneMatches = extractIndianMobileMatches(msg);
        const phones = phoneMatches.map((match) => match.phone);
        const hasNegative = isNegativeWhatsappReply(msgLower);
        const hasPositive = isPositiveWhatsappReply(msgLower);
        const cueIndex = correctionCueIndex(msg);

        if (askedWhatsapp || waitingForDifferentNumber) {
            if (phones.length > 0) {
                // Latest valid mobile after the WhatsApp question wins. This catches
                // corrections even when the caller does not say "wrong", "wait", etc.
                if (hasNegative && cueIndex >= 0) {
                    structuredRejected = true;
                    const afterCorrection = phoneMatches.filter((match) => match.index > cueIndex);
                    if (afterCorrection.length > 0) {
                        resolved = afterCorrection[afterCorrection.length - 1].phone;
                        waitingForDifferentNumber = false;
                    } else {
                        resolved = '';
                        waitingForDifferentNumber = true;
                    }
                } else {
                    resolved = phones[phones.length - 1];
                    waitingForDifferentNumber = false;
                }
                continue;
            }
            if (hasNegative) {
                resolved = '';
                waitingForDifferentNumber = true;
                structuredRejected = true;
                continue;
            }
            if (hasPositive && callerWhatsapp) {
                resolved = callerWhatsapp;
                waitingForDifferentNumber = false;
                continue;
            }
        }

        // Correction cue outside the WhatsApp-question window: use the latest valid mobile.
        if (phones.length > 0 && (hasNegative || /\b(?:wait|ruk|rukiye|likhiye|write|correct|sahi)\b|रुक|लिख|सही/i.test(msgLower))) {
            resolved = phones[phones.length - 1];
        }
    }

    return resolved || (structuredRejected ? callerWhatsapp : structuredWhatsapp) || callerWhatsapp || '';
}

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

    // Initialize Supabase client early for fallback and data matching
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Fetch the conversation list from ElevenLabs API
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    const agentId = payload.agent_id || Deno.env.get('VITE_ELEVENLABS_AGENT_ID') || 'agent_4401kn9khqyzf68t6d99s2a8n9gt';

    let detailedCalls: any[] = [];

    if (ELEVENLABS_API_KEY) {
      try {
        const listRes = await fetch(`https://api.elevenlabs.io/v1/convai/conversations?agent_id=${agentId}`, {
            headers: { "xi-api-key": ELEVENLABS_API_KEY }
        });
        
        if (listRes.ok) {
          const listData = await listRes.json();
          const WIPE_THRESHOLD = 1776942000; 
          const topCalls = (listData.conversations || [])
              .filter((c: any) => c.start_time_unix_secs > WIPE_THRESHOLD)
              .slice(0, limit);

          detailedCalls = await Promise.all(topCalls.map(async (c: any) => {
              try {
                  const detRes = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${c.conversation_id}`, {
                      headers: { "xi-api-key": ELEVENLABS_API_KEY }
                  });
                  if (detRes.ok) return await detRes.json();
                  return null;
              } catch (e) {
                  console.error("Failed to fetch details for", c.conversation_id, e);
                  return null;
              }
          }));
        } else {
          const errBody = await listRes.text();
          console.warn(`ElevenLabs API List Error (${listRes.status}):`, errBody);
        }
      } catch (err: any) {
        console.error("ElevenLabs fetch exception:", err.message);
      }
    }

    // Fallback & Merge: If ElevenLabs API failed or returned fewer calls, load from Supabase call_transcripts table
    const { data: storedTranscripts } = await supabaseClient
        .from('call_transcripts')
        .select('*')
        .order('called_at', { ascending: false })
        .limit(limit);

    const existingConvIds = new Set(detailedCalls.filter(Boolean).map((c: any) => c.conversation_id));

    if (storedTranscripts && storedTranscripts.length > 0) {
      for (const t of storedTranscripts) {
        if (!existingConvIds.has(t.conversation_id)) {
          const transcriptJson = Array.isArray(t.transcript_json) ? t.transcript_json : [];
          detailedCalls.push({
            conversation_id: t.conversation_id,
            transcript: transcriptJson,
            metadata: {
              start_time_unix_secs: t.called_at ? Math.floor(new Date(t.called_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
              call_duration_secs: t.call_duration_secs || 0,
              phone_number: t.phone_number || null,
              call_summary_title: "Inbound Call"
            },
            analysis: {
              transcript_summary: t.transcript_text ? t.transcript_text.slice(0, 200) : "Call recorded."
            }
          });
          existingConvIds.add(t.conversation_id);
        }
      }
    }

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

    // Fetch which conversation_ids have ALREADY been explicitly added to the CRM pipeline
    // Also fetch the automation_error if it exists
    const { data: dbTranscripts } = await supabaseClient
        .from('call_transcripts')
        .select('conversation_id, lead_id, automation_error');
    
    const dbDataMap: Record<string, { lead_id: string | null, error: string | null }> = {};
    (dbTranscripts || []).forEach((t: any) => {
        dbDataMap[t.conversation_id] = { 
            lead_id: t.lead_id, 
            error: t.automation_error || null 
        };
    });

    const linkedLeadIds = Array.from(
        new Set((dbTranscripts || []).map((t: any) => t.lead_id).filter(Boolean))
    );
    const leadContactMap: Record<string, { phone: string | null; whatsapp_number: string | null }> = {};
    if (linkedLeadIds.length > 0) {
        const { data: linkedLeads } = await supabaseClient
            .from('crm_leads')
            .select('id, phone, whatsapp_number')
            .in('id', linkedLeadIds);
        (linkedLeads || []).forEach((lead: any) => {
            leadContactMap[lead.id] = {
                phone: lead.phone || null,
                whatsapp_number: lead.whatsapp_number || null,
            };
        });
    }

    const greetingRecipientByLeadId: Record<string, string> = {};
    const { data: recentGreetingLogs } = await supabaseClient
        .from('whatsapp_logs')
        .select('payload, created_at')
        .filter('payload->>templateName', 'eq', 'post_call_intake')
        .order('created_at', { ascending: false })
        .limit(100);
    (recentGreetingLogs || []).forEach((log: any) => {
        const payload = log.payload || {};
        const leadId = payload.lead_id;
        if (!leadId || greetingRecipientByLeadId[leadId]) return;
        const recipient = normalizeIndianMobile(payload.original_recipient || payload.phone);
        if (recipient) greetingRecipientByLeadId[leadId] = recipient;
    });

    // Format calls for CRM Dashboard
    const formattedLogs = detailedCalls.filter(Boolean).map((c: any) => {
        let capturedName = null;
        let dataCollectionPhone = null;
        let callerPhone = null;
        let capturedWhatsapp = null;
        let intent = c.metadata?.call_summary_title || "Inquiry";
        const transcriptStr = (c.transcript || []).map((t: any) => `${t.role === 'agent' ? 'AI' : 'User'}: ${t.message}`).join('\n');
        const summaryStr = c.analysis?.transcript_summary || c.metadata?.call_summary_title || "Call completed.";
        const duration = c.metadata?.call_duration_secs || 0;

        // Layer 1: ElevenLabs structured data collection
        if (c.analysis && c.analysis.data_collection_results) {
            const dc = c.analysis.data_collection_results;
            capturedName = dc.customer_name?.value || dc.name?.value || null;
            dataCollectionPhone = dc.contact_number?.value || dc.phone_number?.value || dc.whatsapp?.value || null;
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
        if (c.metadata?.phone_number) {
            callerPhone = c.metadata.phone_number;
        }

        // Layer 2.5: Vobiz CDR Timestamp Cross-Reference
        // Match this ElevenLabs call's start time against Vobiz CDR records to get real caller phone
        if (!callerPhone && Object.keys(vobizCallerMap).length > 0) {
            const callStartMs = c.metadata?.start_time_unix_secs
                ? c.metadata.start_time_unix_secs * 1000
                : null;
            if (callStartMs) {
                const key = Math.floor(callStartMs / 10000).toString();
                if (vobizCallerMap[key]) {
                    callerPhone = vobizCallerMap[key];
                    console.log(`[Vobiz CDR] Matched caller: ${callerPhone} for call at ${new Date(callStartMs).toISOString()}`);
                }
            }
        }

        // Layer 3: Dynamic wildcard SIP Header parsing
        let metadataPhone = callerPhone || c.metadata?.phone_number || c.metadata?.caller_id || null;
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

        // Layer 4: Resolve WhatsApp number from the WhatsApp question/reply flow.
        capturedWhatsapp = resolveWhatsappNumber(c.transcript || [], callerPhone, metadataPhone, dataCollectionPhone);

        // Layer 6: Fallback — scan summary text
        if (!capturedWhatsapp && summaryStr) {
            const phoneMatch = summaryStr.match(/(?:\+?91[\s\-]?)?([6-9]\d{9})/);
            if (phoneMatch) capturedWhatsapp = normalizeIndianMobile(phoneMatch[0]);
        }

        // Name fallback from summary
        if (!capturedName && summaryStr) {
            const nameMatch = summaryStr.match(/The user,? ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/);
            if (nameMatch) capturedName = nameMatch[1].trim();
        }

        // A call is only 'Processed' if it was EXPLICITLY added to the pipeline via the button
        const dbInfo = dbDataMap[c.conversation_id];
        const isProcessed = dbInfo?.lead_id !== null && dbInfo?.lead_id !== undefined;
        const linkedLeadContact = dbInfo?.lead_id ? leadContactMap[dbInfo.lead_id] : null;
        const loggedGreetingRecipient = dbInfo?.lead_id ? greetingRecipientByLeadId[dbInfo.lead_id] : '';
        const resolvedWhatsapp =
            loggedGreetingRecipient ||
            normalizeIndianMobile(linkedLeadContact?.whatsapp_number) ||
            normalizeIndianMobile(capturedWhatsapp);
        const resolvedCaller =
            normalizeIndianMobile(callerPhone || metadataPhone) ||
            normalizeIndianMobile(linkedLeadContact?.phone) ||
            resolvedWhatsapp;

        return {
           id: c.conversation_id,
           created_at: new Date(c.metadata?.start_time_unix_secs ? c.metadata.start_time_unix_secs * 1000 : Date.now()).toISOString(),
           duration_seconds: duration,
           intent: intent,
           summary: summaryStr,
           transcript: transcriptStr,
           recording_url: null,
           phone_number: resolvedCaller || null,
           capturedName: capturedName,
           capturedWhatsapp: resolvedWhatsapp || null,
           lead_id: dbInfo?.lead_id || null,
           automation_error: dbInfo?.error || null
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
