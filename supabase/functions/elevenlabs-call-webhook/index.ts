import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const META_SYSTEM_TOKEN = Deno.env.get('META_SYSTEM_TOKEN');
const META_PHONE_ID = Deno.env.get('META_PHONE_ID');
const WHATSAPP_FLOW_ID = Deno.env.get('WHATSAPP_FLOW_ID');
const FLOW_TEMPLATE_NAME = "post_call_intake";

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
    callerPhone: string,
    metadataPhone: string | null,
    dataCollectionPhone: string
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
    // Must return 200 quickly or ElevenLabs will retry/disable the webhook
    if (req.method === 'OPTIONS') {
        return new Response('ok', { 
            headers: { 'Access-Control-Allow-Origin': '*' },
            status: 200 
        });
    }

    try {
        const payload = await req.json();
        console.log('[ElevenLabs Webhook] Received:', JSON.stringify(payload).slice(0, 300));

        // ElevenLabs sends type: "post_call_transcription"
        if (payload.type !== 'post_call_transcription' && !payload.call_id) {
            return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
        }

        // Support both root-level keys (standard) and nested data keys (legacy fallback)
        // ElevenLabs v2 sends fields at root level; the test script / legacy format nests under data{}
        const dataBlock = payload.data || {};
        const conversationId = payload.call_id || payload.conversation_id || dataBlock.conversation_id || '';
        const agentId = payload.agent_id || dataBlock.agent_id || '';
        const transcript = payload.transcript || dataBlock.transcript || [];
        const metadata = payload.metadata || dataBlock.metadata || {};
        const analysis = payload.analysis || dataBlock.analysis || {};
        console.log(`[Webhook] Parsed fields — conversationId=${conversationId}, agentId=${agentId}, transcriptLen=${transcript.length}`);

        const startTimeRaw = metadata.start_time_unix_secs
            ? new Date(metadata.start_time_unix_secs * 1000).toISOString()
            : new Date().toISOString();
        const startTimeUnix = metadata.start_time_unix_secs || Math.floor(Date.now() / 1000);
        const callerPhone = metadata.phone_number || metadata.caller_id || '';
        const callDurationSecs = metadata.call_duration_secs || analysis.call_duration || 0;

        // Build a clean text transcript
        const transcriptText = transcript
            .map((t: any) => `${t.role === 'agent' ? 'Khushi' : 'Lead'}: ${t.message}`)
            .join('\n');
            
        // --- WHATSAPP NUMBER EXTRACTION LOGIC ---
        // Dynamic wildcard SIP Header parsing for the caller/calling number.
        let metadataPhone = metadata?.phone_number || metadata?.caller_id || null;
        if (!metadataPhone && metadata) {
            for (const key in metadata) {
                if (typeof metadata[key] === 'string') {
                    const match = metadata[key].replace(/\D/g, '').match(/(?:91)?([6-9]\d{9})/);
                    if (match) {
                        metadataPhone = '+91' + match[1];
                        break;
                    }
                }
            }
        }

        let dataCollectionWhatsapp = '';
        if (analysis.data_collection_results) {
            const dc = analysis.data_collection_results;
            dataCollectionWhatsapp = dc.contact_number?.value || dc.phone_number?.value || dc.whatsapp?.value || '';
        }

        // Transcript wins over data_collection because callers often correct numbers after the first capture.
        const finalWhatsappNumber = resolveWhatsappNumber(transcript, callerPhone, metadataPhone, dataCollectionWhatsapp);

        // Store the calling number separately from the WhatsApp messaging target.
        const effectivePhoneNumber = finalWhatsappNumber || callerPhone;
        const callLogPhoneNumber = callerPhone || metadataPhone || effectivePhoneNumber;
        const startTime = startTimeRaw;
        
        console.log(`[Webhook] Call from callerPhone="${callerPhone}" | extractedWA="${finalWhatsappNumber}" | effective="${effectivePhoneNumber}" | duration=${callDurationSecs}s`);

        // --- 4. EXTRACT SERVICE & SHIFT FOR GREETING ---
        let detectedService = "Home Healthcare";
        let detectedShift = "General";
        let detectedName = "Customer";

        const serviceKeywords: Record<string, string[]> = {
            "New Born Baby Care": ["newborn", "new born", "neonatal", "nawajaata", "nav janam"],
            "Baby Care": ["baby", "infant", "toddler", "bachcha", "baccha", "shishu"],
            "Japa Care (Post-Delivery)": ["japa", "post delivery", "post-delivery", "prasav ke baad"],
            "Maternity Care": ["maternity", "pregnant", "pregnancy", "prasav", "delivery", "garbhavati"],
            "Old Age Care": ["old age", "elderly", "senior citizen", "geriatric", "budhapa", "buddhe"],
            "Nursing Care": ["nursing", "nurse", "injection", "wound", "dressing", "iv drip", "medical"],
        };

        const shiftKeywords: Record<string, string[]> = {
            "10-Hour": ["10", "day shift", "morning"],
            "24-Hour": ["24", "day and night", "stay", "resident"]
        };

        const tLower = transcriptText.toLowerCase();
        for (const [service, keywords] of Object.entries(serviceKeywords)) {
            if (keywords.some(k => tLower.includes(k))) {
                detectedService = service;
                break;
            }
        }
        for (const [shift, keywords] of Object.entries(shiftKeywords)) {
            if (keywords.some(k => tLower.includes(k))) {
                detectedShift = shift;
                break;
            }
        }

        // Try to get name from analysis or transcript
        if (analysis.data_collection_results?.name) {
            detectedName = analysis.data_collection_results.name.value;
        } else if (metadata.customer_name) {
            detectedName = metadata.customer_name;
        }

        if (!SUPABASE_URL || !SUPABASE_KEY) {
            console.error("Missing Supabase env vars");
            return new Response(JSON.stringify({ ok: false }), { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // Save to call_transcripts table
        const { error } = await supabase
            .from('call_transcripts')
            .upsert({
                conversation_id: conversationId,
                agent_id: agentId,
                phone_number: callLogPhoneNumber,
                transcript_text: transcriptText,
                transcript_json: transcript,
                call_duration_secs: callDurationSecs,
                called_at: startTime,
            }, { onConflict: 'conversation_id' });

        if (error) {
            console.error('[Webhook] Supabase save error:', error.message);
            // Still return 200 so ElevenLabs doesn't retry forever
            return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 200 });
        }

        // If we have a caller phone, let's update their CRM lead record
        const phoneForLookup = callerPhone || effectivePhoneNumber;
        if (phoneForLookup) {
            const last10Caller = phoneForLookup.replace(/\D/g, '').slice(-10);

            // Robust lookup: find lead by last 10 digits regardless of format
            const { data: existingLeads } = await supabase
                .from('crm_leads')
                .select('id, pipeline_stage, name, service_interest, phone, whatsapp_number, notes')
                .or(`phone.ilike.%${last10Caller}%,whatsapp_number.ilike.%${last10Caller}%`)
                .order('created_at', { ascending: false })
                .limit(1);
            const existingLead = existingLeads?.[0] ?? null;

            if (existingLead) {
                console.log(`[Call Webhook] Found lead: ${existingLead.id} (${existingLead.name})`);
                // Update call timestamp and stage if still 'New'
                const updatePayload: any = {
                    last_called_at: startTime,
                    service_interest: detectedService !== 'Home Healthcare' ? detectedService : existingLead.service_interest || undefined,
                    notes: `Service: ${detectedService}\nShift: ${detectedShift}\nSource: AI Phone Call\n\n${existingLead.notes || ''}`
                };
                if (existingLead.pipeline_stage === 'New' || existingLead.pipeline_stage === 'New Inquiry') {
                    updatePayload.pipeline_stage = 'In Discussion';
                }
                await supabase.from('crm_leads').update(updatePayload).eq('id', existingLead.id);
                // Always update WhatsApp number when the transcript resolved one, including "same as caller".
                if (
                    finalWhatsappNumber &&
                    normalizeIndianMobile(existingLead.whatsapp_number) !== normalizeIndianMobile(finalWhatsappNumber)
                ) {
                    await supabase.from('crm_leads').update({ whatsapp_number: finalWhatsappNumber }).eq('id', existingLead.id);
                }
                // Log call_received activity
                await supabase.from('crm_lead_activity').insert([{
                    lead_id: existingLead.id,
                    event_type: 'call_received',
                    description: `AI call received (${Math.round(callDurationSecs)}s)`,
                    metadata: {
                        lead_name: existingLead.name,
                        phone: effectivePhoneNumber || phoneForLookup,
                        source: 'AI Phone Call',
                        stage: updatePayload.pipeline_stage || existingLead.pipeline_stage,
                        conversation_id: conversationId,
                        duration_secs: callDurationSecs,
                        service: detectedService,
                        detected_service: detectedService,
                        shift: detectedShift,
                        reason: 'AI call ended and lead needs review'
                    }
                }]);
                
                // CRITICAL FIX: Link the transcript to the existing lead to prevent UI race conditions
                await supabase.from('call_transcripts').update({ lead_id: existingLead.id }).eq('conversation_id', conversationId);
            } else {
                // Auto-create a new lead for this caller — never miss a contact
                console.log(`[Call Webhook] No existing lead. Auto-creating for ${phoneForLookup}`);
                const newLeadName = detectedName !== 'Customer' ? detectedName : 'Unknown Caller';
                const { data: newLead } = await supabase.from('crm_leads').insert([{
                    name: newLeadName,
                    phone: phoneForLookup,
                    whatsapp_number: effectivePhoneNumber || phoneForLookup,
                    source: 'AI Phone Call',
                    pipeline_stage: 'New Inquiry',
                    service_interest: detectedService !== 'Home Healthcare' ? detectedService : null,
                    notes: `Service: ${detectedService}\nShift: ${detectedShift}\nSource: AI Phone Call`,
                    status: 'new',
                    last_called_at: startTime
                }]).select('id').single();

                if (newLead?.id) {
                    await supabase.from('crm_lead_activity').insert([{
                        lead_id: newLead.id,
                        event_type: 'lead_created',
                        description: 'Lead created via AI phone call',
                        metadata: {
                            lead_name: newLeadName,
                            phone: effectivePhoneNumber || phoneForLookup,
                            source: 'AI Phone Call',
                            stage: 'New Inquiry',
                            conversation_id: conversationId,
                            duration_secs: callDurationSecs,
                            service: detectedService,
                            detected_service: detectedService,
                            shift: detectedShift,
                            reason: 'New voice lead created'
                        }
                    }]);
                    
                    // CRITICAL FIX: Link the transcript to the new lead to prevent UI race conditions
                    await supabase.from('call_transcripts').update({ lead_id: newLead.id }).eq('conversation_id', conversationId);
                }
            }
        } // end if (phoneForLookup)


        console.log(`[Webhook] Transcript saved for conversation: ${conversationId}`);
        return new Response(JSON.stringify({ ok: true, conversation_id: conversationId }), { 
            headers: { 'Content-Type': 'application/json' },
            status: 200 
        });

    } catch (err: any) {
        console.error('[Webhook Critical Error]:', err.message);
        return new Response(JSON.stringify({ ok: false }), { status: 200 }); // Always 200 for ElevenLabs
    }
});
