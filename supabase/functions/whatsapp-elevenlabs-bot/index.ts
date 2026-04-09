import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
    try {
        const url = new URL(req.url);

        // --- META WEBHOOK VERIFICATION (GET hub.challenge) ---
        if (req.method === 'GET' && url.searchParams.has('hub.mode')) {
            const mode = url.searchParams.get('hub.mode');
            const token = url.searchParams.get('hub.verify_token');
            const challenge = url.searchParams.get('hub.challenge');
            
            const META_VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN') || '99care_meta_webhook';

            if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
                console.log('Webhook verified successfully!');
                return new Response(challenge, { status: 200 });
            } else {
                return new Response('Forbidden', { status: 403 });
            }
        }

        if (req.method !== 'POST') {
            return new Response("OK", { status: 200 });
        }

        const body = await req.json();

        // Ensure this is a Meta payload
        if (body.object !== 'whatsapp_business_account' || !body.entry || body.entry.length === 0) {
            return new Response("OK", { status: 200 });
        }

        const entry = body.entry[0];
        if (!entry.changes || entry.changes.length === 0) {
             return new Response("OK", { status: 200 });
        }
        
        const value = entry.changes[0].value;

        // --- 1. HANDLE DELIVERY STATUS REPORTS ---
        if (value.statuses && value.statuses.length > 0) {
            const statusObj = value.statuses[0];
            const wamid = statusObj.id;
            const status = statusObj.status;
            
            const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
            const { data: existingLog } = await supabase
              .from('whatsapp_logs')
              .select('payload')
              .eq('sid', wamid)
              .single();

            const updatedPayload = existingLog?.payload 
              ? { ...existingLog.payload, statuses: value.statuses } 
              : { statuses: value.statuses };

            await supabase.from('whatsapp_logs').update({
              status: status,
              error_code: statusObj.errors ? statusObj.errors[0].code : null,
              error_message: statusObj.errors ? statusObj.errors[0].title : null,
              payload: updatedPayload
            }).eq('sid', wamid);

            console.log(`[Meta Webhook] Delivery Updated: ${wamid} -> ${status}`);
            return new Response('EVENT_RECEIVED', { status: 200 });
        }

        // --- 2. HANDLE INCOMING MESSAGES (AI REPLIES) ---
        if (!value.messages || value.messages.length === 0) {
            return new Response('EVENT_RECEIVED', { status: 200 });
        }

        const incomingMsg = value.messages[0];
        const contact = value.contacts ? value.contacts[0] : null;

        let rawBody = '';
        if (incomingMsg.text && incomingMsg.text.body) {
            rawBody = incomingMsg.text.body;
        } else if (incomingMsg.interactive && incomingMsg.interactive.list_reply) {
            rawBody = incomingMsg.interactive.list_reply.title;
        } else if (incomingMsg.interactive && incomingMsg.interactive.button_reply) {
            rawBody = incomingMsg.interactive.button_reply.title;
        }

        if (!rawBody || !contact) {
            // Ignore media/audio for now, just ACK
            console.log("Received non-text/non-interactive message format.");
            return new Response('EVENT_RECEIVED', { status: 200 });
        }

        const fromPhone = contact.wa_id; // "918000044090"
        
        console.log(`[Incoming Meta WhatsApp] From: ${fromPhone}, Message: ${rawBody}`);

        if (!GROQ_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
            console.error("Missing critical environment variables.");
            return new Response("Config Error", { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        const purePhone = fromPhone.trim(); // Meta already strips 'whatsapp:+'
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
            content: rawBody
        }]);

        // --- NEW LEAD INTERCEPTION (INTERACTIVE MENU) ---
        if (historyData.length === 0) {
            const META_SYSTEM_TOKEN = Deno.env.get('META_SYSTEM_TOKEN');
            const META_PHONE_ID = Deno.env.get('META_PHONE_ID');
            
            if (META_SYSTEM_TOKEN && META_PHONE_ID) {
                const listPayload = {
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: purePhone,
                    type: "interactive",
                    interactive: {
                        type: "list",
                        header: { type: "text", text: "Welcome to 99 Care!" },
                        body: { text: "Namaste! 🙏 I'm Khushi. Please select a service from the menu below to get started:" },
                        footer: { text: "Serving Surat for 5+ years" },
                        action: {
                            button: "Select Service",
                            sections: [
                                {
                                    title: "Available Services",
                                    rows: [
                                        { id: "baby_care", title: "Baby Card / Newborn" },
                                        { id: "japa_care", title: "Japa Care" },
                                        { id: "elderly", title: "Old Age Care" },
                                        { id: "nursing", title: "Nursing Care" },
                                        { id: "physio", title: "Physiotherapy" },
                                        { id: "doc_call", title: "Doctor Visit at Home" },
                                        { id: "medicines", title: "Medicine Delivery" },
                                        { id: "equiprent", title: "Medical Equip. Rent" }
                                    ]
                                }
                            ]
                        }
                    }
                };

                await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${META_SYSTEM_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(listPayload)
                });
                
                await supabase.from('whatsapp_messages').insert([{
                    phone: purePhone, role: 'assistant',
                    content: "Namaste! 🙏 I'm Khushi. Please select a service from the menu below to get started:"
                }]);

                return new Response('EVENT_RECEIVED', { status: 200 });
            }
        }

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
   - Feeding, diapering, bathing, comforting, night support
   - Breastfeeding guidance for new mothers
   - Postpartum support for mothers
   - Sibling care if there are older children
2. Japa Care (Post-delivery mother + baby care)
   - Full maternity support for mother and newborn
   - Available for single or twins
3. Old Age Care / Elderly Care
   - Assistance with daily activities, mobility, medication
   - Health monitoring, emotional support
4. Nursing Care (Home nursing + caretaker)
   - Post-surgery: vital sign monitoring, medication, wound dressing, pain management
   - Diabetes/Hypertension/Wound care: cleaning, infection control, pressure ulcer treatment
   - Hospice care: symptom management, pain relief, emotional support
   - Specialized: IV therapy, catheterization, tracheostomy care, tube feeding
5. On-Call Nursing / Injection at Home
   - Skilled nurses visit home to administer injections with prescription
6. Physiotherapy at Home
   - Qualified physiotherapist visits at preferred time
7. Doctor on Call / Doctor Visit at Home
8. Home Dressing & Wound Treatment
   - Professional wound dressing for surgical/chronic wounds
   - Respiratory care at home for chronic conditions
9. Laboratory Tests at Home
10. Medical Equipment on Rent
11. Home Delivery of Medicines
12. Tiffin Service
13. Health Card AMC

### STRICT PRICING RULE — CRITICAL
- NEVER quote any prices, rates, or amounts to the customer.
- If asked about pricing, say: "Our team will send you a detailed quotation based on your requirements. Please share all the details and we'll get back to you shortly! 😊"
- Do NOT mention ₹850, ₹1050, or any specific pricing numbers in the conversation.
- The ONLY financial detail you can confirm if directly asked: the ₹15,000 deposit is required to START the service and is adjusted in the final bill.

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
3. Once all key details collected → say: "Thank you [Name]! 😊 I've noted all your requirements. Our team will review them and send you a detailed quotation and next steps shortly on this number. Thank you for choosing 99Care! 💙"

### IF USER ALREADY CALLED US:
If there is a PREVIOUS VOICE CALL TRANSCRIPT below, you already know some details. Reference them naturally and skip questions already answered.

### IMPORTANT RULES
- ONLY respond in valid JSON: {"replyToUser": "string or empty string", "pipelineStageUpdate": "string or null"}
- If the user is just ending the conversation (e.g. saying "okay", "thanks", "thik hai", "done") and the conversation is naturally over, silently acknowledge them by setting "replyToUser" to an empty string "". This stops the chatbot from replying unecessarily to dead ends.
- replyToUser must never contain markdown bold/italic. Plain text + emojis only.
- Never give medical advice or diagnosis.
- Never discuss staff salary or payment with leads — redirect to office.
- If out of scope: "I'll pass this to our team who will get back to you shortly! 🙏"

### CRM PIPELINE STAGES
- "New" — just started talking
- "In Discussion" — asking about services / giving info
- "Quotation Sent" — all details collected, told team will send quotation
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

        messages.push({ role: "user", content: rawBody });

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
                max_tokens: 300,
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

        // Return early if the LLM chose to end the conversation gracefully
        if (!aiReplyMsg || aiReplyMsg.trim() === '') {
            console.log(`[Final Meta WhatsApp Reply]: Silenced automatically to prevent infinite chat loop.`);
            return new Response('EVENT_RECEIVED', { status: 200 });
        }

        console.log(`[Final Meta WhatsApp Reply]: ${aiReplyMsg}`);

        // Step 6: Save AI reply to memory
        await supabase.from('whatsapp_messages').insert([{
            phone: purePhone,
            role: 'assistant',
            content: aiReplyMsg
        }]);

        // Step 7: Post proactive reply back to Meta API
        const META_SYSTEM_TOKEN = Deno.env.get('META_SYSTEM_TOKEN');
        const META_PHONE_ID = Deno.env.get('META_PHONE_ID');
        
        if (META_SYSTEM_TOKEN && META_PHONE_ID) {
            await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${META_SYSTEM_TOKEN}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: purePhone,
                    type: "text",
                    text: {
                       preview_url: false,
                       body: aiReplyMsg
                    }
                })
            });
            console.log("Successfully POSTed back to Meta.");
        } else {
            console.error("META_SYSTEM_TOKEN or META_PHONE_ID missing for reply!");
        }

        // Return standard Webhook ACK to Meta
        return new Response('EVENT_RECEIVED', { status: 200 });

    } catch (error: any) {
        console.error("[Webhook Critical Error]", error);
        return new Response('EVENT_RECEIVED', { status: 200 }); // Still return 200 so Meta doesn't retry infinitely
    }
});
