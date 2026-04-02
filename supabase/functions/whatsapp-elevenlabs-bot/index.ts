import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
const AGENT_ID = Deno.env.get('VITE_ELEVENLABS_AGENT_ID') || 'agent_7601kmj6d0dxf8ha6vkrkan0mc00';

serve(async (req) => {
    try {
        const textData = await req.text();
        const params = new URLSearchParams(textData);
        
        const body = params.get('Body') || '';
        const from = params.get('From') || '';
        
        console.log(`[Incoming WhatsApp] From: ${from}, Message: ${body}`);

        if (!body.trim()) {
            return new Response("OK", { status: 200 });
        }

        if (!ELEVENLABS_API_KEY) {
            console.error("Missing ELEVENLABS_API_KEY");
            return new Response("Config Error", { status: 500 });
        }

        console.log("Fetching Signed URL...");
        const signedUrlRes = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${AGENT_ID}`, {
            headers: { 'xi-api-key': ELEVENLABS_API_KEY }
        });
        
        if (!signedUrlRes.ok) throw new Error("Failed to get signed URL: " + await signedUrlRes.text());
        const { signed_url } = await signedUrlRes.json();

        // Wrap WebSocket logic in a Promise to wait for the complete response
        const agentText = await new Promise<string>((resolve, reject) => {
            console.log("Connecting to ElevenLabs WebSocket...");
            const ws = new WebSocket(signed_url);
            let fullResponse = "";
            
            // Timeout gracefully after 12 seconds to ensure Twilio doesn't drop
            const timeout = setTimeout(() => {
                console.log("Timeout waiting for full response. Returning what we have.");
                ws.close();
                resolve(fullResponse || "I'm having a bit of trouble connecting right now. Please try again soon! 🙏");
            }, 12000);

            ws.onopen = () => {
                console.log("WS Connected. Sending user message...");
                
                // Wait a brief moment to let the agent context load before injecting user text
                setTimeout(() => {
                    ws.send(JSON.stringify({
                        type: "user_message",
                        user_message_event: { text: body }
                    }));
                }, 500);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === "agent_response") {
                        const chunk = data.agent_response_event?.agent_response || "";
                        fullResponse += chunk;
                        
                        // We heuristically check if the agent finished its turn.
                        // Sometimes ElevenLabs streams chunk by chunk. We'll wait a bit.
                        // If we see it's a complete sentence or we wait a certain amount of time.
                    }
                } catch (e) {
                    console.error("Parse error:", e);
                }
            };
            
            // Wait 5 seconds after sending the message to gather all text chunks, then close.
            setTimeout(() => {
                clearTimeout(timeout);
                ws.close();
                resolve(fullResponse);
            }, 5500);

            ws.onerror = (e) => {
                console.error("WS Error");
                clearTimeout(timeout);
                reject(e);
            };
        });

        console.log(`[Agent Reply]: ${agentText}`);

        // Strip out audio directives like "[warmly]" from ElevenLabs
        const cleanText = agentText.replace(/\[.*?\]/g, '').trim();

        // Return TwiML
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
        <Body>${cleanText}</Body>
    </Message>
</Response>`;

        return new Response(twiml, {
            headers: { "Content-Type": "text/xml" },
            status: 200
        });

    } catch (error: any) {
        console.error("[Webhook Critical Error]", error);
        
        // Fallback TwiML
        const fallback = `<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>We are currently experiencing high volume. Our team will get back to you shortly! 🙏</Body></Message></Response>`;
        return new Response(fallback, { headers: { "Content-Type": "text/xml" }, status: 200 });
    }
});
