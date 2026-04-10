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

        // Step 0.5: Check Automation Settings (Only block if EXPLICITLY set to false)
        const { data: settings, error: settingsError } = await supabase
            .from('automation_settings')
            .select('greeting_enabled')
            .eq('id', 'global')
            .maybeSingle();

        console.log(`[Settings] greeting_enabled=${settings?.greeting_enabled}, settingsError=${settingsError?.message}`);

        // Only skip if the row exists AND greeting_enabled is explicitly false
        if (settings !== null && settings?.greeting_enabled === false) {
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
            console.error("Missing critical environment variables. GROQ_API_KEY present:", !!GROQ_API_KEY);
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

        // --- NEW LEAD: Send one-shot intake form ---
        if (historyData.length === 0) {
            const META_SYSTEM_TOKEN = Deno.env.get('META_SYSTEM_TOKEN');
            const META_PHONE_ID = Deno.env.get('META_PHONE_ID');

            if (META_SYSTEM_TOKEN && META_PHONE_ID) {
                const intakeMessage = `Namaste! 🙏 I'm Khushi from 99 Care Home Healthcare Services, Surat.

To serve you better, please reply with all the following details in one message:

1️⃣ *Your full name*
2️⃣ *Service needed* (e.g. Old Age Care / Nursing / Japa / Physiotherapy / Doctor Visit)
3️⃣ *City & Area* (e.g. Surat, Vesu)
4️⃣ *Shift type* – 10-hour or 24-hour?
5️⃣ *Who is the care for?* (e.g. Mother, Father, Spouse, Self)

Example reply:
Rajesh Patel | Old Age Care | Surat, Adajan | 10-hour | Mother

Our team will prepare a customised quotation right after! 😊✨`;

                const sendRes = await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${META_SYSTEM_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messaging_product: "whatsapp",
                        recipient_type: "individual",
                        to: purePhone,
                        type: "text",
                        text: { preview_url: false, body: intakeMessage }
                    })
                });

                if (!sendRes.ok) {
                    const sendErr = await sendRes.text();
                    console.error(`[Intake Form Error] ${sendRes.status}: ${sendErr}`);
                }

                await supabase.from('whatsapp_messages').insert([{
                    phone: purePhone, role: 'assistant', content: intakeMessage
                }]);

                // Update log
                await supabase.from('whatsapp_logs').update({
                    status: 'success',
                    payload: { type: 'ai_response', message: intakeMessage, original_recipient: fromPhone }
                }).eq('sid', wamid);

                return new Response('EVENT_RECEIVED', { status: 200 });
            }
        }

        // Step 3: Fetch Lead Data & Voice Call Transcripts for this lead
        let leadDataContext = "";
        let leadRecord: any = null;
        let hasCallData = false;
        try {
            const { data, error: leadError } = await supabase
                .from('crm_leads')
                .select('*')
                .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`)
                .maybeSingle();
            
            leadRecord = data;
            if (leadError) console.error("[Lead Fetch Error]:", leadError);

            const { data: callTranscripts } = await supabase
                .from('call_transcripts')
                .select('transcript_text, called_at, call_duration_secs')
                .like('phone_number', `%${last10}%`)
                .order('called_at', { ascending: false })
                .limit(3);

            hasCallData = !!(callTranscripts && callTranscripts.length > 0);

            // --- RETURNING LEAD WITH CALL DATA: Skip intake, send quotation coming message ---
            if (hasCallData) {
                const leadName = leadRecord?.name ? leadRecord.name.split('—')[0].trim() : 'there';
                const quotationMsg = `Namaste ${leadName} ji! 🙏

We already have your details from our recent call. Our team is preparing a personalised quotation for you and will share it on this WhatsApp number shortly.

Feel free to ask any questions in the meantime. We're always here to help! 😊✨`;

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
                            text: { preview_url: false, body: quotationMsg }
                        })
                    });
                }

                await supabase.from('whatsapp_messages').insert([{ phone: purePhone, role: 'assistant', content: quotationMsg }]);
                await supabase.from('whatsapp_logs').update({
                    status: 'success',
                    payload: { type: 'ai_response', message: quotationMsg, original_recipient: fromPhone }
                }).eq('sid', wamid);

                console.log(`[Bot] Sent call-data quotation message to ${purePhone}`);
                return new Response('EVENT_RECEIVED', { status: 200 });
            }

            if (leadRecord) {
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

            if (callTranscripts && callTranscripts.length > 0) {
                const parts = callTranscripts.map((c: any) => {
                    const date = c.called_at ? new Date(c.called_at).toLocaleDateString('en-IN') : 'Recent';
                    return `--- Voice Call on ${date} (${Math.round((c.call_duration_secs || 0) / 60)} min) ---\n${c.transcript_text}`;
                });
                leadDataContext += `\n\n### PREVIOUS VOICE CALL TRANSCRIPTS WITH THIS LEAD:\n${parts.join('\n\n')}\n### END CALL TRANSCRIPTS`;
            }
        } catch (err) {
            console.error("[Context Fetch Error]:", err);
        }

        // Step 4: Build Groq messages — used only for leads without call data replying to the intake form
        const systemPrompt = `You are Khushi, the warm and efficient WhatsApp AI assistant for 99Care Home Healthcare Services in Surat.
The lead has been asked to share all their details in ONE message (Name, Service, City/Area, Shift type, Who care is for).
Your job is to:
1. Extract any provided details from their message.
2. If all 5 details are present, confirm them warmly and say the team will prepare a quotation and send it shortly.
3. If some details are missing, ask for ONLY the missing ones together (not one by one).
4. Keep replies very short (2-3 lines max).

### PERSONALITY & STYLE:
- Warm, empathetic, very concise.
- Respond in the SAME LANGUAGE as the user (English, Hindi, Hinglish, Gujarati).
- Use natural emojis (🙏, 😊, ✨). No markdown formatting.
- PRICING: Never quote prices.

### DATA CONTEXT:
${leadDataContext}

### TECHNICAL RULES:
- ONLY respond in valid JSON: {"replyToUser": "string", "pipelineStageUpdate": "string or null"}
- replyToUser: Plain text + emojis only, NO markdown.
- pipelineStageUpdate: Use "In Discussion" once you have confirmed all details.`;

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
        console.log(`[Groq] Calling API with ${messages.length} messages, model: llama-3.3-70b-versatile`);
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: messages,
                max_tokens: 400,
                temperature: 0.2
            })
        });

        let aiReplyMsg = "Namaste! 🙏 I'm having a small technical issue. Please send your message again and I'll respond right away!";
        if (!groqRes.ok) {
            const errStatus = groqRes.status;
            const errBody = await groqRes.text();
            console.error(`[Groq Error] Status: ${errStatus}, Body: ${errBody}`);
        } else {
            const groqData = await groqRes.json();
            const rawContent = groqData.choices[0]?.message?.content || '';
            console.log(`[Groq OK] Model: ${groqData.model}, Tokens: ${groqData.usage?.total_tokens}, Raw: ${rawContent.substring(0, 100)}`);
            try {
                // Try parsing JSON from response (with or without markdown code fences)
                const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                const jsonStr = jsonMatch ? jsonMatch[0] : rawContent;
                const parsedResult = JSON.parse(jsonStr);
                if (typeof parsedResult.replyToUser === 'string' && parsedResult.replyToUser.trim() !== "") {
                    aiReplyMsg = parsedResult.replyToUser;
                }
                if (parsedResult.pipelineStageUpdate && typeof parsedResult.pipelineStageUpdate === 'string') {
                    await supabase
                        .from('crm_leads')
                        .update({ pipeline_stage: parsedResult.pipelineStageUpdate })
                        .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`);
                }
            } catch (pErr) {
                // If JSON fails, use raw text directly as reply
                console.error("[JSON Parse Error]:", pErr, "Raw:", rawContent);
                if (rawContent.trim().length > 0 && !rawContent.includes('{')) {
                    aiReplyMsg = rawContent.trim();
                }
            }
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
            const sendRes = await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`, {
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
            if (!sendRes.ok) {
                const sendErr = await sendRes.text();
                console.error(`[Meta Send Error] ${sendRes.status}: ${sendErr}`);
            } else {
                console.log(`[Meta Send OK] Message delivered to ${purePhone}`);
            }
        } else {
            console.error("[Meta Send] Missing META_SYSTEM_TOKEN or META_PHONE_ID env vars!");
        }

        return new Response('EVENT_RECEIVED', { status: 200 });

    } catch (err) {
        console.error("[Global Webhook Error]:", err);
        return new Response('Error', { status: 500 });
    }
});
