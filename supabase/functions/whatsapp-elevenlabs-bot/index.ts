import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const AGENT_ID = Deno.env.get('VITE_ELEVENLABS_AGENT_ID') || 'agent_4401kn9khqyzf68t6d99s2a8n9gt';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
    try {
        const url = new URL(req.url);
        let body = '';
        let from = '';

        if (req.method === 'POST') {
            const textData = await req.text();
            const params = new URLSearchParams(textData);
            body = params.get('Body') || '';
            from = params.get('From') || '';
        } else {
            body = url.searchParams.get('Body') || '';
            from = url.searchParams.get('From') || '';
        }
        
        console.log(`[Incoming WhatsApp] From: ${from}, Message: ${body}`);

        if (!body.trim()) {
            return new Response("OK", { status: 200 });
        }

        if (!GROQ_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
            console.error("Missing critical environment variables.");
            return new Response("Config Error", { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        const purePhone = from.replace('whatsapp:', '').trim();
        const last10 = purePhone.slice(-10);

        // Step 1: Fetch WhatsApp Chat History (most recent 10 messages)
        const { data: rawHistory } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('phone', purePhone)
            .order('created_at', { ascending: false })
            .limit(10);
            
        const historyData = rawHistory?.reverse() || [];

        // Step 2: Save this incoming user message immediately
        await supabase.from('whatsapp_messages').insert([{
            phone: purePhone,
            role: 'user',
            content: body
        }]);

        // Step 3: Fetch Voice Call Transcripts for this lead from Supabase (saved by ElevenLabs webhook)
        let callTranscriptContext = "";
        try {
            const { data: callTranscripts } = await supabase
                .from('call_transcripts')
                .select('transcript_text, called_at, call_duration_secs')
                .like('phone_number', `%${last10}%`)
                .order('called_at', { ascending: false })
                .limit(3);

            if (callTranscripts && callTranscripts.length > 0) {
                const parts = callTranscripts.map((c: any) => {
                    const date = c.called_at
                        ? new Date(c.called_at).toLocaleDateString('en-IN')
                        : 'Recent';
                    return `--- Voice Call on ${date} (${Math.round((c.call_duration_secs || 0) / 60)} min) ---\n${c.transcript_text}`;
                });
                callTranscriptContext = `\n\n### PREVIOUS VOICE CALL TRANSCRIPTS WITH THIS LEAD:\n${parts.join('\n\n')}\n### END CALL TRANSCRIPTS`;
                console.log(`[Transcripts] Found ${callTranscripts.length} call(s) for ${last10}`);
            } else {
                console.log(`[Transcripts] No call history found for ${last10}`);
            }
        } catch (transcriptErr) {
            console.error("[Transcript Fetch Error]:", transcriptErr);
        }

        // Step 4: Build Groq messages with full context
        const systemPrompt = `You are Khushi, a friendly, professional, and empathetic virtual assistant for 99Care Home Healthcare Services on WhatsApp.
Your goal is to quickly qualify leads and collect essential details before handing them off for a callback.

### PERSONALITY & TONE
- Warm, calm, and concise (1-2 sentences max).
- Speak naturally like a human. Use emojis (👋, ✨, 🙏) naturally.
- Use conversational fillers: "Okay", "Got it", "Perfect".
- Understand Hindi, Hinglish, and English. Respond in the language the user speaks.

### CONVERSATION FLOW (STRICT SEQUENCE)
1. Greeting: "Namaste! Thank you for contacting 99Care. 🙏 I'll quickly take a few details to assist you better."
2. Ask for their Name.
3. Ask what service they need (Elderly care, Baby care, Nursing, Physiotherapy, etc.).
4. Ask when they want the service to start.
5. Ask if they need a 10-hour full-day or half-day shift.
6. Closing once all details collected: "Thank you! Our team will call you back shortly with complete details. 📞 A refundable deposit of fifteen thousand rupees is required to confirm the service. Thank you for contacting 99Care."

### IF USER ALREADY CALLED US:
If there is a PREVIOUS VOICE CALL TRANSCRIPT section below, you ALREADY know their name, service, and other details. Reference it naturally: "Based on your call with us, I see you were interested in [service]. Is that still correct?" Do NOT re-ask for information already collected on the call.

### CRITICAL RULES
- ONLY reply in valid JSON format with EXACTLY two keys: "replyToUser" (string) and "pipelineStageUpdate" (string or null).
- Keep replyToUser under 40 words, conversational, no markdown or bold text.
- If user asks for pricing: "Our team will share full pricing details on the call. Let me quickly take your details first."
- If user asks about the deposit: "Yes, it is a standard refundable deposit required before the service starts."
- DO NOT give medical advice.

### CRM PIPELINE STAGES
- Pricing/Quotation discussion -> "Quotation Sent"
- Agreement to book/start -> "Demo Scheduled"
- Not interested/wrong number -> "Lost"
- General questions -> "In Discussion"${callTranscriptContext}`;

        const messages: any[] = [{ role: "system", content: systemPrompt }];

        // Inject WhatsApp chat history as conversation turns
        historyData.forEach((msg: any) => {
            if (msg.content) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            }
        });

        messages.push({ role: "user", content: body });

        // Step 5: Call Groq with strict JSON Mode
        console.log("Calling Groq LLM...");
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: messages,
                response_format: { type: "json_object" },
                max_tokens: 250,
                temperature: 0.2
            })
        });

        let aiReplyMsg = "I'm having a bit of trouble reaching our servers right now. Please try again in a moment! 🙏";

        if (groqRes.ok) {
            const groqData = await groqRes.json();
            const rawContent = groqData.choices[0]?.message?.content || '{}';
            
            try {
                const parsedResult = JSON.parse(rawContent);

                if (parsedResult.replyToUser) {
                    aiReplyMsg = parsedResult.replyToUser;
                }

                // Update CRM pipeline stage if detected
                const newStage = parsedResult.pipelineStageUpdate;
                const validStages = ["New", "In Discussion", "Quotation Sent", "Demo Scheduled", "Lost", "Junk"];
                if (newStage && validStages.includes(newStage)) {
                    console.log(`[CRM] Updating ${last10} to stage: ${newStage}`);
                    await supabase
                        .from('crm_leads')
                        .update({ pipeline_stage: newStage })
                        .like('whatsapp_number', `%${last10}%`);
                }

            } catch (jsonErr) {
                console.error("Failed to parse Groq JSON:", rawContent);
                aiReplyMsg = "Oops! We hit a bit of internal turbulence, please say that again! 💙";
            }
        } else {
            console.error("Groq API error:", await groqRes.text());
        }

        console.log(`[Final WhatsApp Reply]: ${aiReplyMsg}`);

        // Step 6: Save AI reply to memory
        await supabase.from('whatsapp_messages').insert([{
            phone: purePhone,
            role: 'assistant',
            content: aiReplyMsg
        }]);

        // Step 7: Return TwiML response to Twilio
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
        <Body>${aiReplyMsg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Body>
    </Message>
</Response>`;

        return new Response(twiml, {
            headers: { "Content-Type": "text/xml" },
            status: 200
        });

    } catch (error: any) {
        console.error("[Webhook Critical Error]", error);
        const fallback = `<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>We are currently experiencing high volume! Our team will get back to you shortly 🙏</Body></Message></Response>`;
        return new Response(fallback, { headers: { "Content-Type": "text/xml" }, status: 200 });
    }
});
