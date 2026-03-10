import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── 99 Care AI Persona ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Priya, a friendly support agent for 99 Care — a home healthcare service in India.

Services offered: home nursing, caretakers, physiotherapy, baby care, elderly care.
Pricing: nurses ₹500–₹1200/day, caretakers ₹300–₹800/day (varies by city/hours).

Rules:
- Reply SHORT — max 3 sentences for WhatsApp
- Detect if the message is in Hindi or English and reply in the SAME language
- Help clients understand services, collect their requirements, or schedule a callback
- For complex medical needs say: "Hamari team aapko jald call karegi. Kya aap apna number share karenge?" (or English equivalent)
- Never give specific medical advice
- Do NOT reveal you are an AI unless directly asked
- Always end with a helpful next step or question`;

serve(async (req) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    try {
        // Twilio sends form-encoded webhook data
        const text = await req.text();
        const params = new URLSearchParams(text);

        const from = params.get("From") || "unknown";
        const userMessage = params.get("Body") || "";

        console.log(`[WhatsApp AI] From: ${from} | Message: "${userMessage}"`);

        if (!userMessage.trim()) {
            return twiml("Namaste! 99 Care mein aapka swagat hai. Aap kaise madad kar sakte hain?");
        }

        // ── Groq API Call ─────────────────────────────────────────────────────
        const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";

        if (!GROQ_API_KEY) {
            console.error("[WhatsApp AI] GROQ_API_KEY secret not set in Supabase.");
            return twiml("Namaste! Humari AI abhi setup ho rahi hai. Thodi der mein try karein. 🙏");
        }

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userMessage.trim() },
                ],
                max_tokens: 150,
                temperature: 0.7,
            }),
        });

        if (!groqRes.ok) {
            const err = await groqRes.text();
            console.error("[Groq Error]", err);
            throw new Error(`Groq ${groqRes.status}: ${err}`);
        }

        const data = await groqRes.json();
        const aiReply = data.choices?.[0]?.message?.content?.trim()
            || "Namaste! 99 Care mein aapka swagat hai. Aap ki kaise madad kar sakte hain?";

        console.log(`[WhatsApp AI] Reply: "${aiReply}"`);

        // Return TwiML — Twilio sends this automatically as a WhatsApp reply
        return twiml(aiReply);

    } catch (err: any) {
        console.error("[WhatsApp AI] Error:", err.message);
        // Fallback reply so the client always gets a response
        return twiml("Namaste! Abhi thodi technical dikkat hai. Kripya thodi der mein dobara try karein ya +91-XXXXX call karein. 🙏");
    }
});

// ── TwiML helper ──────────────────────────────────────────────────────────────
function twiml(message: string) {
    // Escape XML special chars
    const safe = message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${safe}</Message>
</Response>`;

    return new Response(xml, {
        headers: { "Content-Type": "text/xml; charset=utf-8" },
        status: 200,
    });
}
