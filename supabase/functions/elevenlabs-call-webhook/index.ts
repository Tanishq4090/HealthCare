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

        // Extract phone number — ElevenLabs stores it in metadata.phone_number
        const phoneNumber = metadata.phone_number || metadata.caller_id || '';
        const callDurationSecs = metadata.call_duration_secs || 0;
        const startTime = metadata.start_time_unix_secs
            ? new Date(metadata.start_time_unix_secs * 1000).toISOString()
            : new Date().toISOString();

        // Build a clean text transcript
        const transcriptText = transcript
            .map((t: any) => `${t.role === 'agent' ? 'Khushi' : 'Lead'}: ${t.message}`)
            .join('\n');
        
        console.log(`[Webhook] Call from ${phoneNumber}, duration: ${callDurationSecs}s, turns: ${transcript.length}`);

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
                phone_number: phoneNumber,
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

        // If we have a phone number, also update CRM lead with last_called info
        if (phoneNumber) {
            const last10 = phoneNumber.replace(/\D/g, '').slice(-10);
            await supabase
                .from('crm_leads')
                .update({ 
                    last_called_at: startTime,
                    pipeline_stage: 'In Discussion' 
                })
                .like('whatsapp_number', `%${last10}%`)
                .eq('pipeline_stage', 'New'); // Only auto-update if still "New"
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
