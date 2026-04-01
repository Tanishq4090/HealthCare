import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

serve(async (req) => {
    try {
        // Twilio sends data as application/x-www-form-urlencoded by default
        const textData = await req.text();
        const params = new URLSearchParams(textData);

        const body = params.get('Body') || '';
        const from = params.get('From') || ''; // e.g. whatsapp:+917600004090
        const to = params.get('To') || '';

        console.log(`[Incoming WhatsApp] From: ${from}, Message: ${body}`);

        if (!body || body.trim().length === 0) {
            return new Response("OK", { status: 200 }); // Ignore empty messages
        }

        const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
        const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        if (!GROQ_API_KEY) {
            console.error("Missing GROQ_API_KEY");
            return new Response("Configuration Error", { status: 500 });
        }

        // 1. Generate Intelligent Text Response via Groq (Llama 3 70B)
        const systemPrompt = `You are Eric, the warm, professional, and efficient AI assistant for 99 Care Home Healthcare Services on WhatsApp.
Your goal is to provide helpful, concise answers about our services:
- New Born Baby Care (Japa Maid, Nanny)
- Old Age/Patient Care
- Professional Nursing
- Physiotherapy at Home

Rules:
- Keep responses short (under 60 words) and conversational.
- Use warmEmojis (🙏, ✨, 💙, ✅) professionally.
- No markdown like **bold** or *italics*.
- Language: Respond in the same language the user uses (Hindi, Hinglish, or English).
- Encourage the user to share their specific requirement or location so we can help them better.`;

        let replyText = "I'm sorry, I'm having a bit of trouble connecting at the moment. Please try again in 1 minute!";

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: body }
                ],
                max_tokens: 200,
                temperature: 0.6
            })
        });

        if (groqRes.ok) {
            const groqData = await groqRes.json();
            replyText = groqData.choices[0]?.message?.content || replyText;
        } else {
            console.error("Groq API error:", await groqRes.text());
        }

        // 2. Generate Premium AI Voice Note via ElevenLabs
        let audioUrl = '';
        const ENABLE_VOICE_NOTES = false; // Turned off per user request

        if (ENABLE_VOICE_NOTES && ELEVENLABS_API_KEY) {
            try {
                // Ensure audio bucket exists
                await supabaseClient.storage.createBucket('whatsapp_audio', { public: true });

                // Voice ID: 'pNInz6obpgDQGcFmaJgB' (Adam - professional & deep) 
                // OR 'EXAVITQu4vr4xnSDxMaL' (Bella - soft & helpful)
                const voiceId = 'pNInz6obpgDQGcFmaJgB';
                const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
                    method: 'POST',
                    headers: {
                        'xi-api-key': ELEVENLABS_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        text: replyText,
                        model_id: "eleven_multilingual_v2",
                        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                    })
                });

                if (ttsRes.ok) {
                    const audioBuffer = await ttsRes.arrayBuffer();
                    const fileName = `voicenote-${Date.now()}-${from.replace(/\D/g, '')}.mp3`;

                    const { error: uploadError } = await supabaseClient.storage
                        .from('whatsapp_audio')
                        .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', cacheControl: '3600' });

                    if (!uploadError) {
                        const { data } = supabaseClient.storage.from('whatsapp_audio').getPublicUrl(fileName);
                        audioUrl = data.publicUrl;
                    } else {
                        console.error("Storage upload error:", uploadError);
                    }
                } else {
                    console.error("ElevenLabs error:", await ttsRes.text());
                }
            } catch (err: any) {
                console.error('[Audio Engine Error]', err);
            }
        } else {
            console.error("Missing ELEVENLABS_API_KEY flag in env.");
        }

        // 3. Return TwiML to Twilio to dispatch the response
        let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>
        <Body>${replyText}</Body>`;

        if (audioUrl) {
            twiml += `\n        <Media>${audioUrl}</Media>`;
        }

        twiml += `\n    </Message>\n</Response>`;

        return new Response(twiml, {
            headers: { "Content-Type": "text/xml" },
            status: 200
        });

    } catch (error: any) {
        console.error("[Webhook Critical Error]", error);
        return new Response("Internal Server Error", { status: 500 });
    }
});
