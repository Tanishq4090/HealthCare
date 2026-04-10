import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const META_SYSTEM_TOKEN = Deno.env.get('META_SYSTEM_TOKEN');
const META_PHONE_ID = Deno.env.get('META_PHONE_ID');
const WHATSAPP_FLOW_ID = Deno.env.get('WHATSAPP_FLOW_ID');

serve(async (req) => {
    try {
        const url = new URL(req.url);

        // --- META WEBHOOK VERIFICATION ---
        if (req.method === 'GET' && url.searchParams.has('hub.mode')) {
            const mode = url.searchParams.get('hub.mode');
            const token = url.searchParams.get('hub.verify_token');
            const challenge = url.searchParams.get('hub.challenge');
            const META_VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN') || '99care_meta_webhook';
            if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
                return new Response(challenge, { status: 200 });
            }
            return new Response('Forbidden', { status: 403 });
        }

        if (req.method !== 'POST') return new Response("OK", { status: 200 });

        const body = await req.json();
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        if (body.object !== 'whatsapp_business_account' || !body.entry?.length) {
            return new Response("OK", { status: 200 });
        }

        const value = body.entry[0]?.changes?.[0]?.value;
        if (!value) return new Response("OK", { status: 200 });

        // --- 1. DELIVERY STATUS UPDATES ---
        if (value.statuses?.length > 0) {
            const statusObj = value.statuses[0];
            const { data: existingLog } = await supabase
                .from('whatsapp_logs').select('payload').eq('sid', statusObj.id).maybeSingle();
            const updatedPayload = existingLog?.payload
                ? { ...existingLog.payload, statuses: value.statuses }
                : { statuses: value.statuses };
            await supabase.from('whatsapp_logs').update({
                status: statusObj.status,
                error_code: statusObj.errors?.[0]?.code ?? null,
                error_message: statusObj.errors?.[0]?.title ?? null,
                payload: updatedPayload
            }).eq('sid', statusObj.id);
            console.log(`[Delivery] ${statusObj.id} -> ${statusObj.status}`);
            return new Response('EVENT_RECEIVED', { status: 200 });
        }

        if (!value.messages?.length) return new Response('EVENT_RECEIVED', { status: 200 });

        const incomingMsg = value.messages[0];
        const contact = value.contacts?.[0];
        if (!contact) return new Response('EVENT_RECEIVED', { status: 200 });

        const fromPhone = contact.wa_id;
        const purePhone = fromPhone.trim();
        const last10 = purePhone.slice(-10);
        const wamid = incomingMsg.id;

        // --- 2. CHECK AUTOMATION SETTINGS ---
        const { data: settings } = await supabase
            .from('automation_settings').select('greeting_enabled').eq('id', 'global').maybeSingle();
        console.log(`[Settings] greeting_enabled=${settings?.greeting_enabled}`);
        if (settings !== null && settings?.greeting_enabled === false) {
            console.log(`[Settings] Disabled. Skipping ${purePhone}`);
            return new Response('EVENT_RECEIVED', { status: 200 });
        }

        // --- 3. HANDLE WHATSAPP FLOW FORM SUBMISSION (nfm_reply) ---
        if (incomingMsg.type === 'interactive' && incomingMsg.interactive?.type === 'nfm_reply') {
            console.log(`[Flow] Form submission received from ${purePhone}`);

            let formData: any = {};
            try {
                formData = JSON.parse(incomingMsg.interactive.nfm_reply?.response_json || '{}');
            } catch (e) {
                console.error('[Flow] Failed to parse form response_json:', e);
            }

            const name = formData.name || contact.profile?.name || 'Unknown';
            const service = formData.service || 'Unknown';
            const location = formData.location || '';
            const shiftType = formData.shift_type || '';
            const careFor = formData.care_for || '';

            console.log(`[Flow] Parsed: name=${name}, service=${service}, location=${location}`);

            // Upsert into CRM leads
            const { data: existingLead } = await supabase
                .from('crm_leads')
                .select('id')
                .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`)
                .maybeSingle();

            const leadPayload: any = {
                name,
                whatsapp_number: purePhone,
                source: 'WhatsApp Flow',
                pipeline_stage: 'In Discussion',
                notes: `Service: ${service} | Shift: ${shiftType} | Area: ${location} | Care for: ${careFor}`,
                last_greeted_at: new Date().toISOString(),
            };

            if (existingLead) {
                await supabase.from('crm_leads').update(leadPayload).eq('id', existingLead.id);
                console.log(`[Flow] Updated existing lead: ${existingLead.id}`);
            } else {
                await supabase.from('crm_leads').insert([{ ...leadPayload, status: 'new' }]);
                console.log(`[Flow] Created new lead for ${name}`);
            }

            // Send warm confirmation
            const confirmMsg = `Thank you ${name.split(' ')[0]}! 🙏😊\n\nWe've received your enquiry:\n✅ Service: ${service}\n📍 Area: ${location}\n⏱️ Shift: ${shiftType}\n👤 Care for: ${careFor}\n\nOur team will prepare your personalised quotation and share it on this number shortly. We're excited to serve you! ✨`;

            if (META_SYSTEM_TOKEN && META_PHONE_ID) {
                await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${META_SYSTEM_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messaging_product: "whatsapp",
                        to: purePhone,
                        type: "text",
                        text: { body: confirmMsg }
                    })
                });
            }

            await supabase.from('whatsapp_messages').insert([{ phone: purePhone, role: 'assistant', content: confirmMsg }]);
            await supabase.from('whatsapp_logs').insert([{
                sid: wamid, status: 'success',
                payload: { type: 'flow_submission', name, service, original_recipient: fromPhone }
            }]);

            return new Response('EVENT_RECEIVED', { status: 200 });
        }

        // --- 4. EXTRACT TEXT FROM REGULAR MESSAGES ---
        let rawBody = '';
        if (incomingMsg.text?.body) rawBody = incomingMsg.text.body;
        else if (incomingMsg.interactive?.list_reply) rawBody = incomingMsg.interactive.list_reply.title;
        else if (incomingMsg.interactive?.button_reply) rawBody = incomingMsg.interactive.button_reply.title;

        if (!rawBody) {
            console.log("Non-text message, ignoring.");
            return new Response('EVENT_RECEIVED', { status: 200 });
        }

        // --- 5. IDEMPOTENCY CHECK ---
        const { data: duplicateCheck } = await supabase
            .from('whatsapp_logs').select('sid').eq('sid', wamid).maybeSingle();
        if (duplicateCheck) {
            console.log(`[Idempotency] Already processed: ${wamid}`);
            return new Response('EVENT_RECEIVED', { status: 200 });
        }

        await supabase.from('whatsapp_logs').insert([{
            sid: wamid, status: 'processing',
            payload: { type: 'incoming_message', raw_text: rawBody }
        }]);

        console.log(`[Incoming] From: ${purePhone}, Message: ${rawBody}`);

        if (!GROQ_API_KEY) {
            console.error("Missing GROQ_API_KEY!");
            return new Response("Config Error", { status: 500 });
        }

        // --- 6. FETCH CHAT HISTORY ---
        const { data: rawHistory } = await supabase
            .from('whatsapp_messages').select('*')
            .ilike('phone', `%${last10}%`)
            .order('created_at', { ascending: false }).limit(10);
        const historyData = rawHistory?.reverse() || [];

        await supabase.from('whatsapp_messages').insert([{ phone: purePhone, role: 'user', content: rawBody }]);

        // --- 7. NEW LEAD: Send WhatsApp Flow form (if Flow ID is set), else fallback text ---
        if (historyData.length === 0) {
            if (META_SYSTEM_TOKEN && META_PHONE_ID && WHATSAPP_FLOW_ID) {
                // Send native WhatsApp Flow form
                const flowMessage = {
                    messaging_product: "whatsapp",
                    to: purePhone,
                    type: "interactive",
                    interactive: {
                        type: "flow",
                        header: { type: "text", text: "Welcome to 99 Care! 👋" },
                        body: { text: "Namaste! 🙏 I'm Khushi. To get the best care for your loved ones, please fill in a few quick details and our team will prepare your personalised quotation right away!" },
                        footer: { text: "Trusted by families across Surat" },
                        action: {
                            name: "flow",
                            parameters: {
                                flow_message_version: "3",
                                flow_token: `intake_${purePhone}_${Date.now()}`,
                                flow_id: WHATSAPP_FLOW_ID,
                                flow_cta: "Fill Service Details 📋",
                                flow_action: "navigate",
                                flow_action_payload: { screen: "INTAKE_FORM" }
                            }
                        }
                    }
                };

                const flowRes = await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${META_SYSTEM_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(flowMessage)
                });

                if (!flowRes.ok) {
                    const flowErr = await flowRes.text();
                    console.error(`[Flow Message Error] ${flowRes.status}: ${flowErr}`);
                } else {
                    console.log(`[Flow] Sent intake form to ${purePhone}`);
                }

                const welcomeText = "Namaste! 🙏 Please tap the button above to fill in your service details. It only takes 30 seconds!";
                await supabase.from('whatsapp_messages').insert([{ phone: purePhone, role: 'assistant', content: welcomeText }]);
                await supabase.from('whatsapp_logs').update({
                    status: 'success',
                    payload: { type: 'flow_sent', original_recipient: fromPhone }
                }).eq('sid', wamid);

                return new Response('EVENT_RECEIVED', { status: 200 });
            } else {
                // Fallback: structured text prompt (if FLOW_ID not yet set)
                const fallbackMsg = `Namaste! 🙏 I'm Khushi from 99 Care Home Healthcare Services, Surat.\n\nPlease reply with your details in this format:\n\n*Name | Service | City & Area | Shift (10hr/24hr) | Care for*\n\nExample:\nRajesh Patel | Old Age Care | Surat, Vesu | 10hr | Mother\n\nWe'll prepare your quotation right away! 😊✨`;
                if (META_SYSTEM_TOKEN && META_PHONE_ID) {
                    await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${META_SYSTEM_TOKEN}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messaging_product: "whatsapp", to: purePhone, type: "text", text: { body: fallbackMsg } })
                    });
                }
                await supabase.from('whatsapp_messages').insert([{ phone: purePhone, role: 'assistant', content: fallbackMsg }]);
                await supabase.from('whatsapp_logs').update({
                    status: 'success', payload: { type: 'ai_response', message: fallbackMsg, original_recipient: fromPhone }
                }).eq('sid', wamid);
                return new Response('EVENT_RECEIVED', { status: 200 });
            }
        }

        // --- 8. RETURNING LEAD: Check for call transcript data ---
        let leadDataContext = "";
        let leadRecord: any = null;
        try {
            const { data } = await supabase.from('crm_leads').select('*')
                .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`).maybeSingle();
            leadRecord = data;

            const { data: callTranscripts } = await supabase.from('call_transcripts')
                .select('transcript_text, called_at, call_duration_secs')
                .like('phone_number', `%${last10}%`)
                .order('called_at', { ascending: false }).limit(3);

            if (callTranscripts && callTranscripts.length > 0) {
                const leadName = leadRecord?.name?.split('—')[0]?.trim() || 'there';
                const quotationMsg = `Namaste ${leadName} ji! 🙏\n\nWe already have your details from our recent call. Our team is preparing your personalised quotation and will share it on this number shortly.\n\nFeel free to ask any questions in the meantime. We're always here for you! 😊✨`;

                if (META_SYSTEM_TOKEN && META_PHONE_ID) {
                    await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${META_SYSTEM_TOKEN}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messaging_product: "whatsapp", to: purePhone, type: "text", text: { body: quotationMsg } })
                    });
                }
                await supabase.from('whatsapp_messages').insert([{ phone: purePhone, role: 'assistant', content: quotationMsg }]);
                await supabase.from('whatsapp_logs').update({
                    status: 'success', payload: { type: 'ai_response', message: quotationMsg, original_recipient: fromPhone }
                }).eq('sid', wamid);
                return new Response('EVENT_RECEIVED', { status: 200 });
            }

            if (leadRecord) {
                const isFinished = ['Quotation Sent', 'Staff Assigned', 'Active Client', 'Closed Won'].includes(leadRecord.pipeline_stage);
                leadDataContext = `\n\n### CRM LEAD:\n- Name: ${leadRecord.name}\n- Stage: ${leadRecord.pipeline_stage}\n` +
                    (isFinished ? `### This lead is done. Just say team will be in touch.\n` : '');
            }

            if (callTranscripts && callTranscripts.length > 0) {
                const parts = (callTranscripts as any[]).map((c: any) => `--- Voice Call on ${new Date(c.called_at).toLocaleDateString('en-IN')} ---\n${c.transcript_text}`);
                leadDataContext += `\n\n### CALL TRANSCRIPTS:\n${parts.join('\n\n')}`;
            }
        } catch (err) {
            console.error("[Context Error]:", err);
        }

        // --- 9. GROQ AI FOR ONGOING CONVERSATION ---
        const systemPrompt = `You are Khushi, a warm WhatsApp AI for 99Care Home Healthcare Services, Surat.
The lead has already submitted their intake form or is continuing a conversation.
Respond warmly, answer questions about 99Care's services, and reassure them the team will be in touch.
Keep replies to 2-3 lines max. Use emojis. Same language as user.
NEVER quote prices. NEVER ask for info already collected.
Context: ${leadDataContext}
Respond ONLY as valid JSON: {"replyToUser": "string", "pipelineStageUpdate": "string or null"}`;

        const messages: any[] = [{ role: "system", content: systemPrompt }];
        historyData.forEach((msg: any) => {
            if (msg.content) messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
        });
        messages.push({ role: "user", content: rawBody });

        console.log(`[Groq] Calling with ${messages.length} messages...`);
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages, max_tokens: 300, temperature: 0.2 })
        });

        let aiReplyMsg = "Namaste! 🙏 Our team will get back to you shortly!";
        if (!groqRes.ok) {
            const errBody = await groqRes.text();
            console.error(`[Groq Error] ${groqRes.status}: ${errBody}`);
        } else {
            const groqData = await groqRes.json();
            const rawContent = groqData.choices[0]?.message?.content || '';
            console.log(`[Groq OK] Tokens: ${groqData.usage?.total_tokens}, Raw: ${rawContent.substring(0, 80)}`);
            try {
                const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
                if (parsed.replyToUser?.trim()) aiReplyMsg = parsed.replyToUser;
                if (parsed.pipelineStageUpdate) {
                    await supabase.from('crm_leads').update({ pipeline_stage: parsed.pipelineStageUpdate })
                        .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`);
                }
            } catch (pErr) {
                console.error("[Parse Error]:", pErr);
                if (rawContent.trim() && !rawContent.includes('{')) aiReplyMsg = rawContent.trim();
            }
        }

        await supabase.from('whatsapp_messages').insert([{ phone: purePhone, role: 'assistant', content: aiReplyMsg }]);
        await supabase.from('whatsapp_logs').update({
            status: 'success',
            payload: { type: 'ai_response', message: aiReplyMsg, original_recipient: fromPhone }
        }).eq('sid', wamid);

        if (META_SYSTEM_TOKEN && META_PHONE_ID) {
            const sendRes = await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${META_SYSTEM_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messaging_product: "whatsapp", to: purePhone, type: "text",
                    text: { preview_url: false, body: aiReplyMsg }
                })
            });
            if (!sendRes.ok) console.error(`[Meta Send Error] ${sendRes.status}: ${await sendRes.text()}`);
            else console.log(`[Meta Send OK] to ${purePhone}`);
        }

        return new Response('EVENT_RECEIVED', { status: 200 });

    } catch (err) {
        console.error("[Global Error]:", err);
        return new Response('Error', { status: 500 });
    }
});
