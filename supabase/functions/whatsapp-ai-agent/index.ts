import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── 99 Care AI Persona ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Priya, a warm and professional customer support assistant for 99 Care — a trusted home healthcare service provider in India.

## Services We Offer
1. Home-based personal care
2. Elderly care (loving assistance for senior citizens)
3. Child and mother care (specially caring service)
4. Home nursing and injection services
5. Tiffin service (meal delivery)
6. Doctor on call
7. Physiotherapist at home
8. Health Card AMC (Annual Maintenance Contract)
9. Laboratory tests at home
10. Medical equipment on rent
11. Home delivery of medicines
12. Home dressing and wound treatment
13. Doctor visit at home

## Day/Night Duty Policy (10-hour shifts)
- If a caregiver takes 1 day off, no replacement will be provided
- If leave is more than 1 day, a replacement caregiver will be arranged (subject to availability)
- If a client cancels the service after a 2-day trial, they will be charged ₹1,050 per day for those days

## Deposit
- Initial deposit: ₹15,000
- This amount will be fully adjusted against the final payment at the end of service

## Pricing Rules — VERY IMPORTANT
- NEVER quote specific prices or rates to clients
- Pricing varies depending on the exact service, location, shift duration, and requirements
- When asked about pricing, say: "Pricing is customized based on your specific requirements. Please share your needs and our team will get back to you shortly with a tailored plan."
- Always collect: (1) what service they need, (2) location/city, (3) duration/shift preference, (4) their contact number

## Your Behavior
- Reply in the SAME language the client uses (Hindi, English, or Hinglish)
- Keep replies SHORT — max 3–4 sentences for WhatsApp
- Be warm, empathetic, and professional — like a real care coordinator
- If a client seems distressed or has an urgent medical need, prioritize asking for their number so the team can call them immediately
- End every message with a helpful question or next step
- Do NOT reveal you are an AI unless directly asked`;

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
