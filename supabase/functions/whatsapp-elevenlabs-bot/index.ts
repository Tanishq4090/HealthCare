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
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
            
            const { data: existingLog } = await supabase
              .from('whatsapp_logs')
              .select('payload')
              .eq('sid', wamid)
              .maybeSingle();

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

        const fromPhone = contact.wa_id; 
        const purePhone = fromPhone.trim();
        const last10 = purePhone.slice(-10);
        const wamid = incomingMsg.id;

        // Step 0.5: Check Automation Settings (If Greeting is disabled, stop here)
        const { data: settings } = await supabase
            .from('automation_settings')
            .select('greeting_enabled')
            .eq('id', 'global')
            .maybeSingle();

        if (settings && settings.greeting_enabled === false) {
            console.log(`[Settings] Greeting is DISABLED. Skipping message from ${fromPhone}`);
            return new Response('EVENT_RECEIVED', { status: 200 });
        }

        // Idempotency Check: Prevent duplicate processing if Meta retries the webhook
        const { data: duplicateCheck } = await supabase
            .from('whatsapp_logs')
            .select('sid')
            .eq('sid', wamid)
            .maybeSingle();

        if (duplicateCheck) {
            console.log(`[Idempotency] Already processed or processing message: ${wamid}`);
            return new Response('EVENT_RECEIVED', { status: 200 });
        }

        // Mark as processing immediately
        await supabase.from('whatsapp_logs').insert([{
            sid: wamid,
            status: 'processing',
            payload: { type: 'incoming_message', raw_text: rawBody }
        }]);
        
        console.log(`[Incoming Meta WhatsApp] From: ${fromPhone}, Message: ${rawBody}`);

        if (!GROQ_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
            console.error("Missing critical environment variables.");
            return new Response("Config Error", { status: 500 });
        }

        // Step 1: Fetch WhatsApp Chat History (most recent 10 messages)
        const { data: rawHistory } = await supabase
            .from('whatsapp_messages')
            .select('*')
            .ilike('phone', `%${last10}%`)
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

        // Step 3: Fetch Lead Data & Voice Call Transcripts for this lead
        let leadDataContext = "";
        let leadRecord: any = null;
        try {
            const { data, error: leadError } = await supabase
                .from('crm_leads')
                .select('*')
                .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`)
                .maybeSingle();
            
            leadRecord = data;

            if (leadError) console.error("[Lead Fetch Error]:", leadError);

            if (leadRecord) {
                // If lead is already beyond the discussion stage, tell LLM to be brief
                const isFinished = ['Quotation Sent', 'Staff Assigned', 'Active Client', 'Closed Won'].includes(leadRecord.pipeline_stage);
                
                leadDataContext = `\n\n### EXISTING CRM LEAD DATA:\n` +
                    `- Name: ${leadRecord.name || 'Unknown'}\n` +
                    `- Status: ${leadRecord.status || 'New'}\n` +
                    `- Stage: ${leadRecord.pipeline_stage || 'New'}\n` +
                    `- Est. Value: ${leadRecord.estimated_value_monthly || 'Not set'}\n` +
                    `- Source: ${leadRecord.source || 'Unknown'}\n` +
                    (isFinished ? `### CRITICAL: This lead has ALREADY COMPLETED the intake. Do NOT ask for info. Say you'll contact them soon.\n` : "") +
                    `### END CRM LEAD DATA`;
            }

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
                leadDataContext += `\n\n### PREVIOUS VOICE CALL TRANSCRIPTS WITH THIS LEAD:\n${parts.join('\n\n')}\n### END CALL TRANSCRIPTS`;
            }
        } catch (err) {
            console.error("[Context Fetch Error]:", err);
        }

        // Step 4: Build Groq messages with full context
        const systemPrompt = `You are Khushi, the warm and efficient WhatsApp AI assistant for 99Care Home Healthcare Services in Surat.
Your goal is to collect or verify 6 basic pieces of information from the user conversationally, ONE BY ONE.

### INFORMATION TO COLLECT/VERIFY:
1. **Name**: Their full name.
2. **Service Needed**: Which healthcare service they require (Old Age Care, Nursing, Japa, etc.).
3. **Contact Confirmation**: Verify if the current WhatsApp number is the right one for further process.
4. **Shift Type**: Do they need a 10-hour shift or a 24-hour shift?
5. **Location**: Their specific City and Area in Surat.
6. **Relation**: Who is this service for? (Parent, Grandparent, Spouse, Self, etc.)

### CONVERSATION LOGIC:
- If you ALREADY have any of these details from the "EXISTING CRM LEAD DATA" or "PREVIOUS VOICE CALL" provided below, DO NOT ask for them again. Instead, briefly verify them (e.g., "I see you mentioned needing Old Age care for your father during the call, is that correct?").
- Ask for missing information one or two questions at a time, never a long list.
- **NO MEDICAL DETAILS**: Do not ask about medical conditions, bathing, walking, or specific care needs. Keep it basic.
- **END OF CHAT**: Once all 6 points are collected/verified, say: "Thank you! I have all the basic details. Our team will prepare a quotation and contact you on this number shortly with more details. 🙏😊"
- **STRICTLY END THERE**: Do not ask any more questions after the final confirmation.

### PERSONALITY & STYLE:
- Warm, empathetic, and very concise (1-2 sentences per reply).
- Respond in the SAME LANGUAGE as the user (English, Hindi, Hinglish, Gujarati).
- Use natural emojis (🙏, 😊, ✨).
- PRICING: Never quote prices. Say "Our team will send a detailed quotation based on these details."

### DATA CONTEXT (Use this to avoid redundant questions):
${leadDataContext}

### TECHNICAL RULES:
- ONLY respond in valid JSON: {"replyToUser": "string", "pipelineStageUpdate": "string or null"}
- replyToUser: Plain text + emojis only (no markdown).
- pipelineStageUpdate: Use "In Discussion" once all 6 details are captured.`;

        const messages: any[] = [{ role: "system", content: systemPrompt }];
        historyData.forEach((msg: any) => {
            if (msg.content) {
                messages.push({
                    role: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                });
            }
        });
        messages.push({ role: "user", content: rawBody });

        // Step 5: Call Groq
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: messages,
                response_format: { type: "json_object" },
                max_tokens: 300,
                temperature: 0.2
            })
        });

        let aiReplyMsg = "How can I help you today? 🙏";
        if (!groqRes.ok) {
            const errStatus = groqRes.status;
            const errBody = await groqRes.text();
            console.error(`[Groq Error] Status: ${errStatus}, Body: ${errBody}`);
        } else {
            const groqData = await groqRes.json();
            const rawContent = groqData.choices[0]?.message?.content || '{}';
            try {
                const parsedResult = JSON.parse(rawContent);
                if (typeof parsedResult.replyToUser === 'string' && parsedResult.replyToUser.trim() !== "") {
                    aiReplyMsg = parsedResult.replyToUser;
                }
                if (parsedResult.pipelineStageUpdate && typeof parsedResult.pipelineStageUpdate === 'string') {
                    await supabase
                        .from('crm_leads')
                        .update({ pipeline_stage: parsedResult.pipelineStageUpdate })
                        .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`);
                }
            } catch (pErr) { console.error("[JSON Parse Error]:", pErr); }
        }

        // Step 6: Save AI reply
        await supabase.from('whatsapp_messages').insert([{
            phone: purePhone, role: 'assistant', content: aiReplyMsg
        }]);

        // Step 6.5: Update Log with Result
        await supabase.from('whatsapp_logs').update({
            status: 'success',
            payload: {
                type: 'ai_response',
                message: aiReplyMsg,
                original_recipient: fromPhone,
                pipelineStageUpdate: (leadRecord?.pipeline_stage !== 'In Discussion') ? 'In Discussion' : null
            }
        }).eq('sid', wamid);

        // Step 7: Meta POST
        const META_SYSTEM_TOKEN = Deno.env.get('META_SYSTEM_TOKEN');
        const META_PHONE_ID = Deno.env.get('META_PHONE_ID');
        if (META_SYSTEM_TOKEN && META_PHONE_ID) {
            await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${META_SYSTEM_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    recipient_type: "individual",
                    to: purePhone,
                    type: "text",
                    text: { preview_url: false, body: aiReplyMsg }
                })
            });
        }

        return new Response('EVENT_RECEIVED', { status: 200 });

    } catch (err) {
        console.error("[Global Webhook Error]:", err);
        return new Response('Error', { status: 500 });
    }
});
