import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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
        if (payload.type !== 'post_call_transcription') {
            return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200 });
        }

        const data = payload.data || {};
        const conversationId = data.conversation_id || '';
        const agentId = data.agent_id || '';
        const transcript = data.transcript || [];
        const metadata = data.metadata || {};

        // Extract Caller ID — ElevenLabs stores it in metadata.phone_number
        const callerPhone = metadata.phone_number || metadata.caller_id || '';
        const callDurationSecs = metadata.call_duration_secs || 0;
        const startTime = metadata.start_time_unix_secs
            ? new Date(metadata.start_time_unix_secs * 1000).toISOString()
            : new Date().toISOString();

        // Build a clean text transcript
        const transcriptText = transcript
            .map((t: any) => `${t.role === 'agent' ? 'Khushi' : 'Lead'}: ${t.message}`)
            .join('\n');
            
        // --- WHATSAPP NUMBER EXTRACTION LOGIC ---
        let finalWhatsappNumber = '';

        // 1. Check Data Collection (if ElevenLabs natively extracted it)
        const analysis = data.analysis || {};
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

        // Fallback to caller ID if completely empty?
        // Let's only set it if explicitly found, or provide the caller_phone as a potential.
        // Wait, normally the caller ID *is* the phone number for the Lead record.
        const effectivePhoneNumber = finalWhatsappNumber || callerPhone;
        
        console.log(`[Webhook] Call from ${callerPhone}, Extracted WA: ${finalWhatsappNumber}, duration: ${callDurationSecs}s, turns: ${transcript.length}`);

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
        if (callerPhone) {
            const last10Caller = callerPhone.replace(/\D/g, '').slice(-10);
            
            // Always update their latest WhatsApp number if we found a new one from transcript
            if (finalWhatsappNumber && finalWhatsappNumber !== callerPhone) {
                await supabase
                    .from('crm_leads')
                    .update({ whatsapp_number: finalWhatsappNumber })
                    .or(`whatsapp_number.ilike.%${last10Caller}%,phone.ilike.%${last10Caller}%`);
            }

            // Update pipeline stage to 'In Discussion' only if they were 'New'
            await supabase
                .from('crm_leads')
                .update({ 
                    last_called_at: startTime,
                    pipeline_stage: 'In Discussion' 
                })
                .or(`whatsapp_number.ilike.%${last10Caller}%,phone.ilike.%${last10Caller}%`)
                .eq('pipeline_stage', 'New');
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
