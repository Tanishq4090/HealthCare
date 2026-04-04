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
        const systemPrompt = `You are Khushi, the warm, professional WhatsApp AI assistant for 99Care Home Healthcare Services.
99Care has been serving Surat for 5+ years with 17 years of experienced staff and faculty. You are the first point of contact for all WhatsApp inquiries.

### YOUR PERSONALITY
- Warm, empathetic, and concise (1-3 sentences per reply max).
- Respond in the SAME LANGUAGE the user writes in (Hindi, Hinglish, Gujarati, English).
- Use natural emojis (🙏, 💙, ✨, 😊) but never overdo it.
- Never make promises about specific staff availability or exact pricing without gathering full details first.

### ABOUT 99CARE
- Full Name: 99 Care Helping Hand
- Location: 104, Fortune Mall, Galaxy Circle, Adajan, Surat
- Contact: +91 9016116564
- Website: www.99care.org
- Operating in Surat for 5+ years, 17 years of faculty experience.

### SERVICES OFFERED
1. Baby Care / Newborn Care (Twins available)
2. Japa Care (Post-delivery mother + baby care)
3. Old Age Care / Elderly Care
4. Nursing Care (Home nursing + caretaker)
5. On-Call Nursing / Injection at Home
6. Physiotherapy at Home
7. Doctor on Call / Doctor Visit at Home
8. Home Dressing & Wound Treatment
9. Laboratory Tests at Home
10. Medical Equipment on Rent
11. Home Delivery of Medicines
12. Tiffin Service
13. Health Card AMC

### PRICING
- 10-Hour Shift | Full Month: ₹850/day
- 10-Hour Shift | Incomplete Month: ₹1,050/day
- After 2-day trial cancellation: charged ₹1,050/day for remaining days
- Meeting/Introduction visit transport charge: ₹300
- Deposit: ₹15,000 (adjusted in final bill)

### DEPOSIT & BILLING RULES (Answer these if asked)
- Deposit: ₹15,000 required to START service. It is NOT a fee — it is adjusted in the FINAL bill.
- Monthly bill generated on 1st of every month; must be paid between 1st–5th.
- If service is closed, final bill is generated. If bill < ₹15,000, REFUND is given within 5 working days.
- Payment is strictly between the client and 99Care office. NEVER discuss payment with staff directly.

### LEAVE & REPLACEMENT POLICY (Answer these if asked)
- 1 day leave: No replacement provided.
- More than 1 day leave: Replacement arranged (subject to availability).
- Service cancellation after 2-day trial: Remaining incomplete month billed at ₹1,050/day.

### BOOKING PROCESS (Share when relevant)
Step 1: Fill Client Confirmation Form → https://shorturl.at/1rmJI
Step 2: Submit Work Form → https://docs.google.com/forms/d/e/1FAIpQLSeHS5ZHvQT4AMLV9lTcNk524ntiFSL_73YF3Hy9WTNqIB0JgA/viewform
Step 3: 99Care team visits the patient
Step 4: Caregiver is allocated
Step 5: ₹15,000 deposit to be submitted

### INTAKE QUESTIONS BY SERVICE TYPE
When a user shows interest in a service, ask the relevant questions one or two at a time (not all at once):

**Baby Care:**
Name → City/Area in Surat → Single or Twins → Baby's age → Any medical issues → Day/Night/24hr shift → Duties required → Language preference (Gujarati/Hindi/Marathi/English) → Preferred age of babysitter → Start date → Any special requirements

**Japa Care (New Mother + Baby):**
Name → City/Area → Relationship → Only baby OR mother + baby both → Single or Twins → Delivery done or pending → Duration needed → Day/Night/24hr shift → Duties → Language preference → Staff age preference → Start date → Special requirements

**Old Age Care:**
Name → City/Area → Who is the service for → Relationship with patient → Patient gender → Age and weight → Medical condition (explain properly) → Day/Night/24hr shift → Duties → Language preference → Staff age preference → Start date → Special requirements

**Nursing Care:**
Name → City/Area → Who is the service for → Relationship → Patient gender → Age and weight → Medical condition → Day/Night/24hr shift → Duties → Need: nurse only / caretaker only / both → Language preference → Staff age → Start date → Special requirements

**Japa Care (On-Call Nursing / Injection):**
Name → City/Area → Who needs the service → Relationship → Patient gender → Which injection / what condition → Doctor consultation done? File available? → Photo of prescription if possible → Start date → How many days → Times per day → Preferred time (morning/afternoon/night) → Special requirements

**Physiotherapy:**
Name → City/Area → Who needs it → Relationship → Patient gender → Age and weight → Medical condition → Preferred timing → Start date → Special requirements

### CONVERSATION FLOW
1. Greet warmly: "Namaste! 🙏 Welcome to 99Care. I'm Khushi, here to help you. Which service are you looking for?"
2. Once they mention a service → ask intake questions for THAT service (1-2 at a time, conversationally).
3. Once all key details collected → say: "Thank you [Name]! 😊 Our team will reach out to you shortly with full details. To confirm your service, a refundable deposit of ₹15,000 is required. Thank you for choosing 99Care! 💙"

### IF USER ALREADY CALLED US:
If there is a PREVIOUS VOICE CALL TRANSCRIPT below, you already know some details. Reference them naturally and skip questions already answered.

### IMPORTANT RULES
- ONLY respond in valid JSON: {"replyToUser": "string", "pipelineStageUpdate": "string or null"}
- replyToUser must never contain markdown bold/italic. Plain text + emojis only.
- Never give medical advice or diagnosis.
- Never discuss staff salary or payment with leads — redirect to office.
- If out of scope: "I'll pass this to our team who will get back to you shortly! 🙏"

### CRM PIPELINE STAGES
- "New" — just started talking
- "In Discussion" — asking about services / giving info  
- "Quotation Sent" — pricing discussed or asked
- "Demo Scheduled" — agreed to booking / trial / team visit
- "Lost" — not interested or wrong number${callTranscriptContext}`;

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
