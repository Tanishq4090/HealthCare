import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
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

        // 1. Fetch Chat History (Memory) -> Fix applied: descending order, then reversed for chronological context
        const { data: rawHistory } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('phone', purePhone)
            .order('created_at', { ascending: false })
            .limit(10);
            
        const historyData = rawHistory?.reverse() || [];

        // Map history to Groq format
        const messages: any[] = [
            {
                role: "system",
                content: `You are Eric, the warm and professional AI assistant for 99 Care Home Healthcare Services on WhatsApp.
Services we provide: New Born Baby care (Japa Maid, Nanny), Old Age/patient care, Professional Nursing, Physiotherapy at home.

CRITICAL RULES:
- You must ONLY reply in valid JSON format. Do not add conversational text outside the JSON.
- Output JSON schema MUST contain two fields: "replyToUser" (string) and "pipelineStageUpdate" (string OR null).
- Keep "replyToUser" short (under 40 words), highly conversational, and DO NOT use markdown formatting (no bold/italics!). Use nice emojis.
- Understand Hindi, Hinglish, and English. Respond naturally in the language the user speaks.

CRM AUTOMATION RULES for "pipelineStageUpdate":
Based on user intent, return one of these exact strings for 'pipelineStageUpdate' (or null if unchanged):
- If user asks for pricing/quotation -> "Quotation Sent"
- If user agrees to book/demo / wants to start -> "Demo Scheduled"
- If user is not interested/wrong number -> "Lost"
- If user is just asking generic questions -> "In Discussion"`
            }
        ];

        if (historyData) {
            historyData.forEach(msg => {
                if (msg.content) {
                    messages.push({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        // Avoid feeding bad JSON to history. Just give plain content back for context.
                        content: msg.content
                    });
                }
            });
        }

        messages.push({ role: "user", content: body });

        // Save incoming user message to memory immediately
        await supabase.from('whatsapp_messages').insert([{
            phone: purePhone,
            role: 'user',
            content: body
        }]);

        // 2. Call Groq with STRICT JSON Mode (Eliminates XML tag bleeding)
        console.log("Calling Groq LLM with JSON Mode...");
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

        let aiReplyMsg = "I'm having a bit of trouble reaching our servers right now. Please test again in a minute! 🙏";

        if (groqRes.ok) {
            const groqData = await groqRes.json();
            const rawContent = groqData.choices[0]?.message?.content || '{}';
            
            try {
                const parsedResult = JSON.parse(rawContent);

                // 1. Extract clean reply for WhatsApp
                if (parsedResult.replyToUser) {
                    aiReplyMsg = parsedResult.replyToUser;
                }

                // 2. Handle CRM Stage Update 
                const newStage = parsedResult.pipelineStageUpdate;
                const validStages = ["New", "In Discussion", "Quotation Sent", "Demo Scheduled", "Lost", "Junk"];
                if (newStage && validStages.includes(newStage)) {
                    console.log(`[CRM Integration] Updating Lead ${purePhone} to Pipeline Stage: ${newStage}`);
                    await supabase
                        .from('crm_leads')
                        .update({ pipeline_stage: newStage })
                        .like('whatsapp_number', `%${purePhone.slice(-10)}%`);
                }

            } catch (jsonErr) {
                console.error("Failed to parse Groq JSON:", rawContent);
                aiReplyMsg = "Oops! We hit a bit of internal turbulence, please say that again! 💙";
            }
        } else {
            console.error("Groq API error:", await groqRes.text());
        }

        console.log(`[Final WhatsApp Reply]: ${aiReplyMsg}`);

        // Save AI reply to memory for context
        await supabase.from('whatsapp_messages').insert([{
            phone: purePhone,
            role: 'assistant',
            content: aiReplyMsg
        }]);

        // Return TwiML
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
