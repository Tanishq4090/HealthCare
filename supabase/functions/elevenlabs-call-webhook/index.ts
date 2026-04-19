import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const META_SYSTEM_TOKEN = Deno.env.get('META_SYSTEM_TOKEN');
const META_PHONE_ID = Deno.env.get('META_PHONE_ID');
const WHATSAPP_FLOW_ID = Deno.env.get('WHATSAPP_FLOW_ID');
const FLOW_TEMPLATE_NAME = "post_call_intake";

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
        const conversationId = payload.call_id || payload.conversation_id || (payload.data?.conversation_id) || '';
        const agentId = payload.agent_id || (payload.data?.agent_id) || '';
        const transcript = payload.transcript || (payload.data?.transcript) || [];
        const metadata = payload.metadata || (payload.data?.metadata) || {};
        const analysis = payload.analysis || (payload.data?.analysis) || {};

        const startTimeRaw = metadata.start_time_unix_secs
            ? new Date(metadata.start_time_unix_secs * 1000).toISOString()
            : new Date().toISOString();
        const startTimeUnix = metadata.start_time_unix_secs || Math.floor(Date.now() / 1000);
        const callerPhone = metadata.phone_number || metadata.caller_id || '';
        const callDurationSecs = metadata.call_duration_secs || analysis.call_duration || 0;

        // --- NEW: VOBIZ CDR LOOKUP (Direct Provider Caller ID) ---
        // If ElevenLabs doesn't send a phone number, we fetch it directly from the Vobiz provider CDRs
        // Vobiz might take a few seconds to generate the CDR after a call ends. 
        // We poll up to 4 times (every 3 seconds) to ensure we capture the number.
        let vobizCallerPhone = '';
        const VOBIZ_AUTH_ID = Deno.env.get('VOBIZ_AUTH_ID');
        const VOBIZ_AUTH_TOKEN = Deno.env.get('VOBIZ_AUTH_TOKEN');

        if (!metadata.phone_number && VOBIZ_AUTH_ID && VOBIZ_AUTH_TOKEN) {
            const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
            const TRIES = 4;
            
            for (let attempt = 1; attempt <= TRIES; attempt++) {
                try {
                    if (attempt > 1) {
                        console.log(`[Vobiz] Waiting 3 seconds for CDR... (Attempt ${attempt}/${TRIES})`);
                        await delay(3000);
                    } else {
                        console.log(`[Vobiz] Attempting provider CDR lookup for call at ${startTimeRaw}`);
                    }

                    const cdrRes = await fetch(
                        `https://api.vobiz.ai/api/v1/account/${VOBIZ_AUTH_ID}/cdr/recent?limit=30`,
                        { headers: { 'X-Auth-ID': VOBIZ_AUTH_ID, 'X-Auth-Token': VOBIZ_AUTH_TOKEN, 'Accept': 'application/json' } }
                    );
                    
                    if (cdrRes.ok) {
                        const cdrData = await cdrRes.json();
                        const records = cdrData.data || [];
                        // Match by timestamp: ElevenLabs start_time vs Vobiz record start_time
                        // We check a ±60 second window for fuzzy matching
                        for (const rec of records) {
                            if (rec.call_direction === 'inbound' && rec.caller_id_number && rec.start_time) {
                                const vobizTime = new Date(rec.start_time).getTime() / 1000;
                                const diff = Math.abs(vobizTime - startTimeUnix);
                                if (diff <= 60) {
                                    vobizCallerPhone = rec.caller_id_number;
                                    console.log(`[Vobiz Match] Found Caller ID "${vobizCallerPhone}" (Diff: ${diff}s) on attempt ${attempt}`);
                                    break;
                                }
                            }
                        }
                    }
                } catch (e: any) {
                    console.error(`[Vobiz Lookup] Error on attempt ${attempt}:`, e.message);
                }
                
                // Exit polling loop if we found the number
                if (vobizCallerPhone) break;
            }
        }
        // -------------------------------------------------------------

        // Build a clean text transcript
        const transcriptText = transcript
            .map((t: any) => `${t.role === 'agent' ? 'Khushi' : 'Lead'}: ${t.message}`)
            .join('\n');
            
        // --- WHATSAPP NUMBER EXTRACTION LOGIC ---
        let finalWhatsappNumber = '';

        // 1. Check Data Collection (if ElevenLabs natively extracted it)
        if (analysis.data_collection_results && analysis.data_collection_results.whatsapp) {
             finalWhatsappNumber = analysis.data_collection_results.whatsapp.value;
        }

        // 2. Dynamic wildcard SIP Header parsing
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

        // 3. Transcript Analysis for "Yes" confirmation or dictated number
        if (!finalWhatsappNumber && transcript.length > 0) {
            for (let i = 0; i < transcript.length; i++) {
                const turn = transcript[i];
                const msg = turn.message?.toLowerCase() || '';

                // If user dictates a 10 digit number anywhere, grab it
                if (turn.role === 'user') {
                    const phoneMatch = msg.replace(/[\s\-\.]/g, '').match(/(?:\+?91)?([6-9]\d{9})/);
                    if (phoneMatch) {
                        finalWhatsappNumber = '+91' + phoneMatch[1];
                    }
                }

                // If agent asks if this is their WhatsApp number natively in English or Hindi
                if (turn.role === 'agent' && msg.includes('whatsapp')) {
                    // Check the immediate next reply from the user
                    if (i + 1 < transcript.length && transcript[i+1].role === 'user') {
                        const userReply = transcript[i+1].message?.toLowerCase() || '';
                        if (['yes', 'haan', 'ji', 'yep', 'hanji', 'ha', 'same', 'yup', 'हाँ', 'जी', 'हां'].some(word => userReply.includes(word))) {
                            finalWhatsappNumber = metadataPhone || "Confirmed (No Caller ID)";
                        }
                    }
                }
            }
        }

        // Fallback to Vobiz Provider ID -> Transcription ID -> Caller ID
        const effectivePhoneNumber = finalWhatsappNumber || vobizCallerPhone || callerPhone;
        const startTime = startTimeRaw;
        
        console.log(`[Webhook] Call from ${callerPhone}, Vobiz: ${vobizCallerPhone}, Extracted WA: ${finalWhatsappNumber}, duration: ${callDurationSecs}s`);

        // --- 4. EXTRACT SERVICE & SHIFT FOR GREETING ---
        let detectedService = "Home Healthcare";
        let detectedShift = "General";
        let detectedName = "Customer";

        const serviceKeywords: Record<string, string[]> = {
            "Baby Care": ["baby", "child", "infant", "newborn", "japa", "bachcha", "baccha"],
            "Old Age Care": ["old age", "elderly", "senior", "parent", "mother", "father", "dadi", "dada", "nana", "nani"],
            "Nursing Care": ["nursing", "medical", "hospital", "patient", "nurse", "injection", "wound"],
            "Physiotherapy": ["physio", "exercise", "therapy", "rehab", "back pain", "paralysis"]
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
                phone_number: effectivePhoneNumber,
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
                .select('id, pipeline_stage, name')
                .or(`phone.ilike.%${last10Caller}%,whatsapp_number.ilike.%${last10Caller}%`)
                .order('created_at', { ascending: false })
                .limit(1);
            const existingLead = existingLeads?.[0] ?? null;

            if (existingLead) {
                console.log(`[Call Webhook] Found lead: ${existingLead.id} (${existingLead.name})`);
                // Update call timestamp and stage if still 'New'
                const updatePayload: any = { last_called_at: startTime };
                if (existingLead.pipeline_stage === 'New' || existingLead.pipeline_stage === 'New Lead') {
                    updatePayload.pipeline_stage = 'In Discussion';
                }
                await supabase.from('crm_leads').update(updatePayload).eq('id', existingLead.id);
                // Always update WhatsApp number if transcript extracted a different/new one
                if (finalWhatsappNumber && finalWhatsappNumber !== callerPhone) {
                    await supabase.from('crm_leads').update({ whatsapp_number: finalWhatsappNumber }).eq('id', existingLead.id);
                }
            } else {
                // Auto-create a new lead for this caller — never miss a contact
                console.log(`[Call Webhook] No existing lead. Auto-creating for ${phoneForLookup}`);
                await supabase.from('crm_leads').insert([{
                    name: detectedName !== 'Customer' ? detectedName : 'Unknown Caller',
                    phone: phoneForLookup,
                    whatsapp_number: effectivePhoneNumber || phoneForLookup,
                    source: 'AI Phone Call',
                    pipeline_stage: 'New Inquiry',
                    status: 'new',
                    last_called_at: startTime
                }]);
            }

            // --- 5. DISPATCH AUTOMATED WHATSAPP GREETING (TEMPLATE + FLOW) ---
            const purePhone = effectivePhoneNumber.replace(/\D/g, '');
            if (purePhone) {
                console.log(`[Webhook] Triggering greeting via meta-whatsapp-outbound for ${purePhone}`);
                
                try {
                    const { data: outData, error: outError } = await supabase.functions.invoke('meta-whatsapp-outbound', {
                        body: {
                            phone: purePhone,
                            useTemplate: true,
                            templateName: FLOW_TEMPLATE_NAME,
                            templateParams: [
                                detectedName.split(' ')[0],
                                detectedService,
                                detectedShift
                            ]
                        }
                    });

                    if (outError) {
                        const errorMsg = `Greeting trigger failed: ${outError.message || 'Unknown error'}`;
                        console.error(`[Webhook] ${errorMsg}`);
                        // Update both tables if possible, but call_transcripts for sure
                        await supabase.from('call_transcripts').update({ automation_error: errorMsg }).eq('conversation_id', conversationId);
                        await supabase.from('crm_call_logs').update({ automation_error: errorMsg }).eq('call_id', conversationId);
                    } else {
                        console.log(`[Webhook] Greeting dispatched successfully:`, outData);
                        await supabase.from('whatsapp_messages').insert([{ 
                            phone: effectivePhoneNumber, 
                            role: 'assistant', 
                            content: `[Automated Greeting] Sent service details confirmation for ${detectedService} (${detectedShift} shift).` 
                        }]);
                    }
                } catch (invokeErr: any) {
                    const errorMsg = `Invocation error: ${invokeErr.message}`;
                    console.error(`[Webhook] ${errorMsg}`);
                    await supabase.from('call_transcripts').update({ automation_error: errorMsg }).eq('conversation_id', conversationId);
                    await supabase.from('crm_call_logs').update({ automation_error: errorMsg }).eq('call_id', conversationId);
                }
            } else {
                const failMsg = `No valid 10-digit phone number found. Caller ID was: ${callerPhone}`;
                console.error(`[Webhook] Greeting skipped: ${failMsg}`);
                await supabase.from('call_transcripts').update({ automation_error: failMsg }).eq('conversation_id', conversationId);
                await supabase.from('crm_call_logs').update({ automation_error: failMsg }).eq('call_id', conversationId);
            }
        }

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
