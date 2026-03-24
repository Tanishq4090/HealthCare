import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── 99 Care AI Persona ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Priya, a warm and professional customer support assistant for 99 Care — a trusted home healthcare service provider in India.

## Goal: Lead Qualification Flow
You must qualify the prospect by asking these exact questions ONE BY ONE. Wait for their answer before asking the next question. Do not ask multiple questions in one message!
1. "Namaste! Welcome to 99 Care. Before I can assist you with pricing or details, may I know your name and who needs the care?"
2. "What specific service are you looking for? (e.g., Home Nursing, Elder Care, Baby Care, Physiotherapist)"
3. "Which area or city are you located in?"
4. "Got it. And how long do you need the service? (e.g., 10-hour day shift, 24-hour live-in, or just a few days?)"

## Tool Execution Rule
Once the user has answered ALL 4 questions (Name, Service, Location, Duration), you MUST immediately call the \`save_lead_info\` tool with the extracted details and set the pipeline_stage to "Form Submitted". Do not say anything else until the tool finishes.

## Behavioral Rules
- Reply in the exact same language the client uses (Hindi, English, or Hinglish).
- Be incredibly succinct. Keep replies to 2 sentences max. You are chatting on WhatsApp.
- NEVER quote specific prices. Say: "Pricing depends on the exact shift and location. Our care coordinator will give you the exact quote."`;

serve(async (req) => {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    try {
        const text = await req.text();
        const params = new URLSearchParams(text);

        const from = params.get("From") || "unknown"; // e.g. "whatsapp:+919876543210"
        const phoneDigits = from.replace(/\D/g, "");
        const userMessage = params.get("Body") || "";

        console.log(`[WhatsApp AI] From: ${phoneDigits} | Message: "${userMessage}"`);

        // Setup Supabase (Service Role to bypass policies for Webhooks)
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Fetch Chat History Memory
        const { data: pastMessages } = await supabase
            .from("whatsapp_messages")
            .select("role, content")
            .eq("phone", phoneDigits)
            .order("created_at", { ascending: false })
            .limit(10);
            
        // Groq requires oldest first
        const chatHistory = (pastMessages || []).reverse().map(m => ({
            role: m.role,
            content: m.content
        }));

        // Determine if the AI already finished the sequence
        const toolAlreadyCalled = chatHistory.some(m => m.role === 'assistant' && 
            m.content.includes("I've sent everything to our care coordination team"));

        // If tool was already called and user just says "okay/thanks", silently ignore to gracefully end chat
        const isShortGoodbye = userMessage.trim().length <= 20 && /ok|okay|k|thanks|thank you|bye|cool|done/i.test(userMessage);
        
        if (toolAlreadyCalled && isShortGoodbye) {
            console.log("[WhatsApp AI] Silently ending conversation for short goodbye.");
            return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
                headers: { "Content-Type": "text/xml; charset=utf-8" },
                status: 200
            });
        }

        // 2. Prepare Tool Schema
        const tools = [
            {
                type: "function",
                function: {
                    name: "save_lead_info",
                    description: "Saves the extracted lead information to the CRM pipeline database.",
                    parameters: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "The full name of the client" },
                            service_required: { type: "string", description: "The healthcare service they need" },
                            location: { type: "string", description: "City or specific area" },
                            duration: { type: "string", description: "Shift preference (e.g., 24hr, 10hr)" },
                            pipeline_stage: { type: "string", description: "Must be exactly 'Form Submitted'" }
                        },
                        required: ["name", "service_required", "location", "pipeline_stage"]
                    }
                }
            }
        ];

        // 3. Call Groq LLaMA 3
        const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
        const messagesPayload = [
            { role: "system", content: SYSTEM_PROMPT + (toolAlreadyCalled ? "\n\nCRITICAL: The lead details have already been saved. Do NOT ask any more qualifying questions. Just answer the user's final question simply. If it's a casual goodbye, just say a short 'You're welcome!'." : "") },
            ...chatHistory,
            { role: "user", content: userMessage.trim() }
        ];

        const groqBody: any = {
            model: "llama-3.3-70b-versatile",
            messages: messagesPayload,
            max_tokens: 250,
            temperature: 0.6,
        };

        // Only attach tools if we haven't already saved the lead
        if (!toolAlreadyCalled) {
            groqBody.tools = tools;
            groqBody.tool_choice = "auto";
        }

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(groqBody),
        });

        if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}`);
        const groqData = await groqRes.json();
        const responseMessage = groqData.choices?.[0]?.message;

        let finalReply = responseMessage?.content || "";

        // 4. Handle Tool Calls if Groq decided to save the lead
        if (responseMessage?.tool_calls) {
            for (const toolCall of responseMessage.tool_calls) {
                if (toolCall.function.name === "save_lead_info") {
                    const args = JSON.parse(toolCall.function.arguments);
                    console.log("[Tool Call Triggered] Saving Lead:", args);

                    // Insert or update Supabase CRM
                    const { error: insertErr } = await supabase.from("crm_leads").insert([{
                        name: args.name,
                        phone: phoneDigits,
                        whatsapp_number: phoneDigits,
                        source: "WhatsApp AI",
                        status: "Processed",
                        pipeline_stage: args.pipeline_stage,
                        service_type: `${args.service_required} (Loc: ${args.location}, Time: ${args.duration})`
                    }]);
                    if (insertErr) console.error("Failed to insert CRM Lead:", insertErr.message);

                    // Generate a nice exit response natively since the AI stopped talking to call the tool
                    finalReply = "Got it! Thanks for sharing those details. I've sent everything to our care coordination team. They will review your requirements and call you back in 10-15 minutes with a customized quotation and staff profiles! 🙏";
                }
            }
        }

        if (!finalReply) {
             finalReply = "Namaste! 99 Care mein aapka swagat hai. Aap ki kaise madad kar sakte hain?";
        }

        console.log(`[WhatsApp AI] Reply: "${finalReply}"`);

        // 5. Save the Conversation to Memory asynchronously
        const { error: memoryErr } = await supabase.from("whatsapp_messages").insert([
            { phone: phoneDigits, role: "user", content: userMessage.trim() },
            { phone: phoneDigits, role: "assistant", content: finalReply }
        ]);
        if (memoryErr) console.error("Warning: Could not save message memory.", memoryErr.message);

        // 6. Return Twilio TwiML
        return twiml(finalReply);

    } catch (err: any) {
        console.error("[WhatsApp AI] Error:", err.message);
        return twiml("Namaste! Abhi thodi technical dikkat hai. Kripya thodi der mein dobara try karein. 🙏");
    }
});

// ── TwiML helper ──────────────────────────────────────────────────────────────
function twiml(message: string) {
    const safe = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${safe}</Message>
</Response>`;
    return new Response(xml, { headers: { "Content-Type": "text/xml; charset=utf-8" }, status: 200 });
}
