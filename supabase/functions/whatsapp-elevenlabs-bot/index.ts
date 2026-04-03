import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const AGENT_ID = Deno.env.get('VITE_ELEVENLABS_AGENT_ID') || 'agent_7601kmj6d0dxf8ha6vkrkan0mc00';
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

        if (!ELEVENLABS_API_KEY || !SUPABASE_URL || !SUPABASE_KEY || !GROQ_API_KEY) {
            console.error("Missing critical environment variables.");
            return new Response("Config Error", { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        const purePhone = from.replace('whatsapp:', '').trim();

        // 1. Fetch Chat History (Memory)
        const { data: historyData } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .eq('phone', purePhone)
            .order('created_at', { ascending: true })
            .limit(10);
            
        // Build History string for ElevenLabs Native Agent
        let historyString = "";
        if (historyData && historyData.length > 0) {
            historyString = "### PREVIOUS CHAT HISTORY (Do not reply to this, just remember it for context):\n";
            historyData.forEach(msg => {
                const speaker = msg.role === 'user' ? 'User' : 'You (Agent)';
                historyString += `${speaker}: ${msg.content}\n`;
            });
            historyString += "### END PREVIOUS CHAT HISTORY\n\n";
        }

        const formattedMessageForAgent = `${historyString}### NEW USER MESSAGE (Reply directly to this contextually):\n${body}`;

        // Save incoming user message to memory immediately
        await supabase.from('whatsapp_messages').insert([{
            phone: purePhone,
            role: 'user',
            content: body
        }]);

        // 2. Background Task: Silent CRM Updater using Groq
        const silentCRMUpdate = async () => {
            try {
                const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${GROQ_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "llama-3.1-8b-instant",
                        messages: [
                            {
                                role: "system",
                                content: `You are a background routing AI for 99 Care Home Healthcare Services (services: New Born Baby Care, Professional Nursing, Old Age Care, Physiotherapy). Look at the user's latest message and return ONLY a single JSON object classifying their pipeline stage based on intent. 
Valid stages: "New", "In Discussion", "Quotation Sent", "Demo Scheduled", "Lost", "Junk".
Rule: Return ONLY RAW JSON. No markdown, no tags, no extra text. Example: {"stage": "In Discussion"}`
                            },
                            { role: "user", content: `History:\n${historyString}\n\nUser's Latest Message: ${body}` }
                        ],
                        response_format: { type: "json_object" },
                        temperature: 0.1
                    })
                });

                if (groqRes.ok) {
                    const groqData = await groqRes.json();
                    const intent = JSON.parse(groqData.choices[0]?.message?.content || '{}');
                    if (intent.stage) {
                        console.log(`[CRM Background Updater] Found intent: ${intent.stage} for phone ${purePhone}`);
                        await supabase
                            .from('crm_leads')
                            .update({ pipeline_stage: intent.stage })
                            .like('whatsapp_number', `%${purePhone.slice(-10)}%`);
                    }
                }
            } catch (err) {
                console.error("[CRM Background Updater Error]:", err);
            }
        };

        // Fire the background updater without waiting
        silentCRMUpdate();

        // 3. Connect to ElevenLabs Agent
        console.log("Fetching ElevenLabs Signed URL...");
        const signedUrlRes = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${AGENT_ID}`, {
            headers: { 'xi-api-key': ELEVENLABS_API_KEY }
        });
        
        if (!signedUrlRes.ok) throw new Error("Failed to get signed URL: " + await signedUrlRes.text());
        const { signed_url } = await signedUrlRes.json();

        const agentText = await new Promise<string>((resolve, reject) => {
            console.log("Connecting to ElevenLabs WebSocket...");
            const ws = new WebSocket(signed_url);
            let fullResponse = "";
            let messageSent = false;
            
            const timeout = setTimeout(() => {
                ws.close();
                resolve(fullResponse || "I'm having a bit of trouble connecting right now! 🙏");
            }, 10000); // 10s master timeout

            ws.onopen = () => {
                console.log("WS Connected. Sending contextual payload...");
                
                // Wait briefly for ElevenLabs session to init
                setTimeout(() => {
                    ws.send(JSON.stringify({
                        type: "user_message",
                        user_message_event: { text: formattedMessageForAgent }
                    }));
                    messageSent = true;
                }, 800);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "agent_response") {
                        const chunk = data.agent_response_event?.agent_response || "";
                        fullResponse += chunk;
                    }
                } catch (e) {
                    console.error("Parse error:", e);
                }
            };
            
            // Gather text chunks for 6 seconds, then close
            setTimeout(() => {
                clearTimeout(timeout);
                ws.close();
                resolve(fullResponse);
            }, 6000);

            ws.onerror = (e) => {
                clearTimeout(timeout);
                reject(e);
            };
        });

        // Strip out audio directives like "[warmly]" & format for WhatsApp
        const cleanText = agentText.replace(/\[.*?\]/g, '').trim();
        console.log(`[ElevenLabs Native Reply]: ${cleanText}`);

        // Save AI reply to memory
        await supabase.from('whatsapp_messages').insert([{
            phone: purePhone,
            role: 'assistant',
            content: cleanText
        }]);

        // Return TwiML
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
        <Body>${cleanText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Body>
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
