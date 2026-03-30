import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

serve(async (req) => {
    try {
        const url = new URL(req.url);

        // Twilio sends data as application/x-www-form-urlencoded by default
        const textData = await req.text();
        const params = new URLSearchParams(textData);

        const body = params.get('Body') || '';
        const from = params.get('From') || '';
        const to = params.get('To') || '';

        console.log(`Received WhatsApp message from ${from}: ${body}`);

        if (!body) {
            return new Response("OK", { status: 200 }); // Ignore empty
        }

        const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
        if (!GROQ_API_KEY) {
            console.error("Missing GROQ_API_KEY");
            return new Response("OK", { status: 200 });
        }

        const systemPrompt = `You are Eric, the friendly and professional AI assistant for 99 Care Home Healthcare Services on WhatsApp. 
Your goal is to answer questions, explain services (New Born Baby Care, Old Age Care, Physiotherapy, Nursing), and encourage users to book an appointment or provide their details for a callback.
Keep your responses short, natural, and conversational, perfect for WhatsApp. Use basic emojis warmly but sparingly. Never use markdown formatting like **bold** because it looks weird on some devices.`;

        let replyText = "I'm having a little trouble connecting right now, please try again in a moment!";

        try {
            const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama3-70b-8192",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: body }
                    ],
                    max_tokens: 150,
                    temperature: 0.7
                })
            });

            if (groqRes.ok) {
                const groqData = await groqRes.json();
                replyText = groqData.choices[0]?.message?.content || replyText;
            } else {
                console.error("Groq API errored:", await groqRes.text());
            }
        } catch (e) {
            console.error("Failed to call Groq", e);
        }

        console.log(`Replying to ${from} with: ${replyText}`);

        // Try to generate ElevenLabs Voice Note
        let audioUrl = '';
        const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        if (ELEVENLABS_API_KEY) {
            try {
                // Ensure bucket exists (ignores error if it already exists)
                await supabaseClient.storage.createBucket('whatsapp_audio', { public: true });
                
                // Call ElevenLabs TTS (Using Eric/Brian voice ID - 'nPczCjzI2devNBz1zQ07' or generic 'EXAVITQu4vr4xnSDxMaL' Bella)
                // We'll use a generic premium energetic male voice: "pNInz6obpgDQGcFmaJgB" (Adam)
                const voiceId = 'pNInz6obpgDQGcFmaJgB'; 
                const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
                    method: 'POST',
                    headers: {
                        'xi-api-key': ELEVENLABS_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: replyText,
                        model_id: "eleven_multilingual_v2"
                    })
                });

                if (ttsRes.ok) {
                    const audioBuffer = await ttsRes.arrayBuffer();
                    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`;
                    
                    const { error: uploadError } = await supabaseClient.storage
                        .from('whatsapp_audio')
                        .upload(fileName, audioBuffer, { contentType: 'audio/mpeg' });
                        
                    if (!uploadError) {
                        const { data } = supabaseClient.storage.from('whatsapp_audio').getPublicUrl(fileName);
                        audioUrl = data.publicUrl;
                        console.log(`Generated WhatsApp Voice Note: ${audioUrl}`);
                    } else {
                        console.error('Failed to upload audio to Supabase:', uploadError);
                    }
                } else {
                    console.error('ElevenLabs TTS failed:', await ttsRes.text());
                }
            } catch (err) {
                console.error('Error generating audio:', err);
            }
        }

        // Twilio expects TwiML response for webhooks to send message back immediately
        let twiml = `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n    <Message>\n        <Body>${replyText}</Body>`;
        if (audioUrl) {
            twiml += `\n        <Media>${audioUrl}</Media>`;
        }
        twiml += `\n    </Message>\n</Response>`;

        return new Response(twiml, {
            headers: { "Content-Type": "text/xml" },
            status: 200
        });

    } catch (error: any) {
        console.error("Webhook processing error:", error);
        return new Response("Error", { status: 500 });
    }
});
