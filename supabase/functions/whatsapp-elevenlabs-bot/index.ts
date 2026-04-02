import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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

        const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
        const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

        if (!GROQ_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
            console.error("Missing critical environment variables.");
            return new Response("Config Error", { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // Standardize the phone number for lookup (strip 'whatsapp:' prefix if present)
        const purePhone = from.replace('whatsapp:', '').trim();

        // 1. Fetch Chat History (Memory)
        const { data: historyData } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('phone', purePhone)
            .order('created_at', { ascending: true })
            .limit(10);
            
        // Map history to Groq format
        const messages: any[] = [
            {
                role: "system",
                content: `You are Eric, the warm and professional AI assistant for 99 Care Home Healthcare Services on WhatsApp.
Services we provide: New Born Baby care (Japa Maid, Nanny), Old Age/patient care, Professional Nursing, Physiotherapy at home.

Rules:
- Keep responses short (under 40 words) and highly conversational.
- Understand Hindi, Hinglish, and English. Respond in the language the user speaks.
- NO markdown formatting (like **bold** or *italics*). It looks bad on SMS.
- Use warm emojis.

IMPORTANT CRM AUTOMATION RULES:
Based on what the user says, use the \`update_lead_pipeline\` tool to move the user to the correct stage:
- If the user asks for pricing, quotation, or costs -> call tool with "Quotation Sent".
- If the user agrees to book, schedule, or wants a demo -> call tool with "Demo Scheduled".
- If the user says they are not interested, stop, or wrong number -> call tool with "Lost" or "Junk".
- Otherwise, for general questions, call tool with "In Discussion".`
            }
        ];

        if (historyData) {
            historyData.forEach(msg => {
                if (msg.content) {
                    messages.push({
                        role: msg.role === 'user' ? 'user' : 'assistant',
                        content: msg.content
                    });
                }
            });
        }

        // Add the current incoming message
        messages.push({ role: "user", content: body });

        // Save incoming user message to memory
        await supabase.from('whatsapp_messages').insert([{
            phone: purePhone,
            role: 'user',
            content: body
        }]);

        // 2. Define the exact tools
        const tools = [
            {
                type: "function",
                function: {
                    name: "update_lead_pipeline",
                    description: "Updates the CRM pipeline stage of the lead based on their intent.",
                    parameters: {
                        type: "object",
                        properties: {
                            pipeline_stage: {
                                type: "string",
                                enum: ["New", "In Discussion", "Quotation Sent", "Demo Scheduled", "Lost", "Junk"],
                                description: "The new pipeline stage for the lead."
                            }
                        },
                        required: ["pipeline_stage"]
                    }
                }
            }
        ];

        // 3. Call Groq
        console.log("Calling Groq LLM with Memory & Tools...");
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: messages,
                tools: tools,
                tool_choice: "auto",
                max_tokens: 150,
                temperature: 0.5
            })
        });

        let aiReplyMsg = "I'm having a bit of trouble reaching our servers right now. Please test again in a minute! 🙏";

        if (groqRes.ok) {
            const groqData = await groqRes.json();
            const responseMessage = groqData.choices[0]?.message;

            // Handle Tool Calls (Pipeline Updates)
            if (responseMessage?.tool_calls) {
                for (const toolCall of responseMessage.tool_calls) {
                    if (toolCall.function.name === 'update_lead_pipeline') {
                        try {
                            const args = JSON.parse(toolCall.function.arguments);
                            const newStage = args.pipeline_stage;
                            console.log(`[Tool Executed] Updating Lead ${purePhone} to Pipeline Stage: ${newStage}`);
                            
                            // We attempt to update the lead with this exact phone number (using ILIKE/pattern matching since it could have a '+')
                            await supabase
                                .from('crm_leads')
                                .update({ pipeline_stage: newStage })
                                .like('whatsapp_number', `%${purePhone.slice(-10)}%`);
                        } catch (e) {
                            console.error("Failed to execute tool:", e);
                        }
                    }
                }
            }

            // Extract the text reply. If Groq used a tool, it might not return text immediately, so we check.
            if (responseMessage?.content) {
                aiReplyMsg = responseMessage.content;
            } else {
                // If the model only returned a tool call without a text message to the user, we send a generic confirmation
                aiReplyMsg = "Great! I've updated your profile accordingly in our system. Let me know if you need anything else! ✨";
            }
        } else {
            console.error("Groq API error:", await groqRes.text());
        }

        // Save AI reply to memory
        await supabase.from('whatsapp_messages').insert([{
            phone: purePhone,
            role: 'assistant',
            content: aiReplyMsg
        }]);

        console.log(`[Agent Reply]: ${aiReplyMsg}`);

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
