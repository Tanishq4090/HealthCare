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

            // --- CONSENT FORM FLOW BRANCH ---
            if (formData.flow_type === 'consent_form') {
                console.log(`[Flow] Processing Consent Form for ${formData.patient_name}`);
                
                // Find existing lead to attach to
                const { data: existingLeads } = await supabase
                    .from('crm_leads')
                    .select('id, pipeline_stage')
                    .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`)
                    .order('created_at', { ascending: false })
                    .limit(1);
                const existingLead = existingLeads?.[0] ?? null;

                if (existingLead) {
                    // Automatically advance the CRM pipeline
                    await supabase.from('crm_leads').update({ pipeline_stage: 'Form Submitted' }).eq('id', existingLead.id);
                    
                    // Securely store the patient details and terms acceptance
                    await supabase.from('client_consents').insert([{
                        lead_id: existingLead.id,
                        phone: purePhone,
                        relative_name: formData.relative_name,
                        patient_name: formData.patient_name,
                        age: formData.age,
                        weight: formData.weight,
                        contact_number: formData.contact_number,
                        alternate_contact_number: formData.alternate_contact_number,
                        address: formData.address,
                        reference_by: formData.reference_by,
                        service_start_date: formData.service_start_date,
                        service_category: formData.service_category,
                        offered_time: formData.offered_time,
                        other_details: formData.other_details,
                        terms_accepted: formData.terms_accepted === 'on' || formData.terms_accepted === true
                    }]);

                    // Log activity event
                    await supabase.from('crm_lead_activity').insert([{
                        lead_id: existingLead.id,
                        event_type: 'form_filled',
                        description: `Consent form filled for ${formData.patient_name}`,
                        metadata: { patient_name: formData.patient_name, service_category: formData.service_category }
                    }]);
                } else {
                    console.warn(`[Flow] Consent Form received but no CRM Lead found for ${purePhone}! Saving orphans not implemented.`);
                }

                // Send warm final confirmation back to patient
                const fname = formData.relative_name ? formData.relative_name.split(' ')[0] : 'there';
                const confirmMsg = `Thank you ${fname}! 🙏😊\n\nWe have successfully received your Consent form along with the service details for ${formData.patient_name}.\nOur team will now proceed with final deployment arrangements and staff assignment for your requirement! ✨`;

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
                    payload: { type: 'flow_submission_consent', patient_name: formData.patient_name, other_details: formData.other_details, original_recipient: fromPhone }
                }]);
                
                return new Response('EVENT_RECEIVED', { status: 200 });
            }

            // --- LEGACY LEAD QUALIFICATION FLOW BRANCH ---

            const name = formData.name || formData.patient_name || contact?.profile?.name || 'Unknown';
            const service = formData.service
                || formData.service_type
                || formData.service_required
                || formData.service_name
                || formData.services
                || formData.service_category
                || formData.serviceRequired
                || formData['Service Required']
                || formData['service required']
                || 'Unknown';
            const country = formData.country || '';
            const state = formData.state || '';
            const city = formData.city || '';
            const area = formData.area || formData.area_pincode || formData['area_pincode'] || '';
            const shiftType = formData.shift_type
                || formData.shift
                || formData.shift_type_required
                || formData['Shift Type']
                || formData['shift type']
                || '';
            const careFor = formData.care_for || formData.careFor || formData.care_required || '';

            console.log(`[Flow] Parsed: name=${name}, service=${service}, shift=${shiftType}`);

            // ── Build location string FIRST (used both in notes and activity log) ──
            const locationStr = [area, city, state, country].filter(Boolean).join(', ');

            // Upsert into CRM leads
            const { data: existingLeads } = await supabase
                .from('crm_leads')
                .select('id, pipeline_stage, notes')
                .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`)
                .order('created_at', { ascending: false })
                .limit(1);
            const existingLead = existingLeads?.[0] ?? null;

            // Only move to 'In Discussion' if lead is still in early stages.
            // Never overwrite a downstream stage like 'Quotation Sent', 'Staff Assigned' etc.
            const earlyStages = ['New Lead', 'New Inquiry', 'In Discussion', ''];
            const currentStage = existingLead?.pipeline_stage || '';
            const shouldUpdateStage = earlyStages.includes(currentStage);

            // Don't overwrite service if lead already has one in notes
            let existingService = 'Unknown';
            if (existingLead?.notes) {
                const match = existingLead.notes.match(/Service:\s*(.+)/i);
                if (match && match[1]) existingService = match[1].trim();
            }
            const resolvedService = service !== 'Unknown' ? service
                : (existingService !== 'Unknown' ? existingService : 'Unknown');

            const leadPayload: any = {
                name,
                whatsapp_number: purePhone,
                source: 'WhatsApp Flow',
                ...(shouldUpdateStage ? { pipeline_stage: 'In Discussion' } : {}),
                notes: `Service: ${resolvedService}\nShift: ${shiftType}\nLocation: ${locationStr}\nCare for: ${careFor}`,
                last_greeted_at: new Date().toISOString(),
            };

            let upsertedLeadId: string | null = existingLead?.id ?? null;
            if (existingLead) {
                const { error: updErr } = await supabase.from('crm_leads').update(leadPayload).eq('id', existingLead.id);
                if (updErr) console.error(`[Flow] DB Update Error for lead ${existingLead.id}:`, updErr);
                else console.log(`[Flow] Updated existing lead: ${existingLead.id} (stage preserved: ${!shouldUpdateStage ? currentStage : 'In Discussion'})`);
            } else {
                const { data: newLead, error: insErr } = await supabase.from('crm_leads').insert([{ ...leadPayload, pipeline_stage: 'In Discussion', status: 'new' }]).select('id').single();
                if (insErr) console.error(`[Flow] DB Insert Error:`, insErr);
                upsertedLeadId = newLead?.id ?? null;
                console.log(`[Flow] Created new lead for ${name}`);
            }

            // Log form_filled activity
            if (upsertedLeadId) {
                const { error: actErr } = await supabase.from('crm_lead_activity').insert([{
                    lead_id: upsertedLeadId,
                    event_type: 'form_filled',
                    description: `Intake form submitted — Service: ${resolvedService}`,
                    metadata: { service: resolvedService, shift_type: shiftType, care_for: careFor, location: locationStr }
                }]);
                if (actErr) console.error(`[Flow] Activity Insert Error:`, actErr);
            }

            // Send warm confirmation echoing back their details
            const firstName = name.split(' ')[0];
            const confirmMsg = `Thank you ${firstName}! 🙏😊\n\nWe've received your details:\n✅ Service: ${resolvedService}\n${shiftType ? `⏱️ Shift: ${shiftType}\n` : ''}${locationStr ? `📍 Area: ${locationStr}\n` : ''}${careFor ? `👤 Care for: ${careFor}\n` : ''}\nOur 99 Care team will prepare your personalised quotation and share it with you shortly. We're excited to serve you! ✨`;

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

                // Removed ADMIN NOTIFICATION here per user request, it will only notify via CRM browser push notification
            }

            await supabase.from('whatsapp_messages').insert([{ phone: purePhone, role: 'assistant', content: confirmMsg }]);
            await supabase.from('whatsapp_logs').insert([{
                sid: wamid, status: 'success',
                payload: { type: 'flow_submission', name, service: resolvedService, original_recipient: fromPhone }
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

        // --- 5. IDEMPOTENCY CHECK (Atomic) ---
        // Attempt to log the incoming message immediately. 
        // If 'sid' is unique, this will fail for retries.
        const { error: idempotencyError } = await supabase.from('whatsapp_logs').insert([{
            sid: wamid, 
            status: 'processing',
            payload: { type: 'incoming_message', raw_text: rawBody }
        }]);

        if (idempotencyError) {
            // Check for unique violation (23505) or if it's already being handled
            if (idempotencyError.code === '23505') {
                console.log(`[Idempotency] Message already being processed or finished: ${wamid}. Bailing.`);
                return new Response('EVENT_RECEIVED', { status: 200 });
            }
            console.warn(`[Idempotency Warning] ${idempotencyError.code}: ${idempotencyError.message}`);
            // If it's some other db error, we'll try to check one more time manually
            const { data: duplicateCheck } = await supabase.from('whatsapp_logs').select('sid').eq('sid', wamid).maybeSingle();
            if (duplicateCheck) return new Response('EVENT_RECEIVED', { status: 200 });
        }

        console.log(`[Incoming] From: ${purePhone}, Message: ${rawBody}`);

        // --- 5.5 LOG USER MESSAGE (Only once) ---
        await supabase.from('whatsapp_messages').insert([{ phone: purePhone, role: 'user', content: rawBody }]);

        if (!GROQ_API_KEY) {
            console.error("Missing GROQ_API_KEY!");
            return new Response("Config Error", { status: 500 });
        }

        // --- 9. FETCH CHAT HISTORY (needed by stop-word filter below) ---
        const { data: rawHistory } = await supabase
            .from('whatsapp_messages').select('*')
            .ilike('phone', `%${last10}%`)
            .order('created_at', { ascending: false }).limit(10);
        const historyData = rawHistory?.reverse() || [];

        // --- 7. UNIVERSAL ACKNOWLEDGMENT FILTER ---
        // Any short CLOSING remark: log it silently, do NOT reply.
        // This prevents the bot from annoying users who just say 'thanks'.
        const positiveIntentWords = ['yes', 'proceed', 'confirm', 'agree', 'start', 'let\'s go', 'go ahead', 'sahi hai', 'bilkul', 'zaroor', 'done', 'okay', 'ready', 'accept', 'allow'];
        const stopWords = [
            'thanks', 'thank you', 'thankyou', 'thank u', 'ty', 'thx', 'shukriya', 'dhanyavad', 'dhanyawaad',
            'ok', 'okay', 'k', 'noted', 'received', 'got it', 'alright',
            'hanji', 'ji', 'acha', 'accha', 'theek hai', 'thik hai', 'haan ji',
            'bye', 'goodbye', 'good bye', 'bye bye', 'alvida', 'tata',
            'take care', 'you too', 'same to you', 'tc', 'see you', 'see ya', 'ttyl',
            'have a nice day', 'have a good day', 'good night', 'good morning', 'good afternoon', 'good evening'
        ];
        const cleanMsg = rawBody.toLowerCase().trim().replace(/[^\w\s]/g, '').trim();
        
        // If it's pure stopword-only message, we stay silent even for new leads
        const isStopWord = stopWords.includes(cleanMsg);
        const isPositiveIntent = positiveIntentWords.some(w => cleanMsg === w || cleanMsg.startsWith(w));

        if (isStopWord && !isPositiveIntent) {
            // Check if we already sent an acknowledgment response in history to avoid repeating ourselves
            const lastAssistantMsg = historyData.filter(m => m.role === 'assistant').pop();
            const alreadyAcknowledged = lastAssistantMsg && (
                lastAssistantMsg.content.includes("prepar") || 
                lastAssistantMsg.content.includes("contact") || 
                lastAssistantMsg.content.includes("shukriya") ||
                stopWords.some(sw => lastAssistantMsg.content.toLowerCase().includes(sw))
            );

            if (alreadyAcknowledged) {
                console.log(`[Acknowledgment Filter] Already acknowledged recently. Staying silent for: "${rawBody}" from ${purePhone}`);
            } else {
                console.log(`[Acknowledgment Filter] First acknowledgment. Preparing brief reply logic if needed, but standardizing on silence for safety.`);
            }

            await supabase.from('whatsapp_logs').update({
                status: 'success',
                payload: { type: 'acknowledgment_silent_exit', text: rawBody, already_acknowledged: !!alreadyAcknowledged, original_recipient: fromPhone }
            }).eq('sid', wamid);
            return new Response('EVENT_RECEIVED', { status: 200 });
        }

        // --- 8. LOOKUP EXISTING CRM LEAD (ROBUST) ---
        const { data: earlyLeads } = await supabase
            .from('crm_leads')
            .select('id, pipeline_stage, name')
            .or(`phone.eq.${purePhone},whatsapp_number.eq.${purePhone},phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`)
            .order('created_at', { ascending: false })
            .limit(1);
        const earlyLead = earlyLeads?.[0] ?? null;
        console.log(`[CRM] Lead Lookup: ${earlyLead ? earlyLead.id + ' (' + earlyLead.pipeline_stage + ')' : 'None found for ' + purePhone}`);

        // --- 10. NEW LEAD: Send WhatsApp Flow form (if Flow ID is set), else fallback text ---
        if (!earlyLead) {
            // Upsert into CRM leads immediately so they show up on Kanban
            await supabase.from('crm_leads').insert([{ 
                name: contact?.profile?.name || 'Unknown Lead',
                whatsapp_number: purePhone,
                source: 'WhatsApp Chat',
                pipeline_stage: 'New Lead',
                status: 'new'
            }]);

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

        // --- 9. STAGE-SCRIPTED RESPONSES ---
        // For specific pipeline stages, send a precise pre-written reply instead of calling Groq.
        // This guarantees consistent, on-brand messaging at every step of the customer journey.
        // NOTE: We never update the pipeline stage here — the CRM team does that manually.
        const quotationAlreadySent = historyData.some(m => m.role === 'assistant' && (m.content.includes('Pricing Information') || m.content.includes('Service Details for')));
        
        // Dynamic check for form completion status
        let isFormFilled = false;
        if (earlyLead?.id) {
            const { data: formLogs } = await supabase
                .from('whatsapp_logs')
                .select('id')
                .filter('payload->>type', 'eq', 'flow_submission')
                .or(`payload->>'original_recipient'.ilike.%${last10}%,payload->>'phone'.ilike.%${last10}%`)
                .gt('created_at', earlyLead.created_at) // Only count forms filled for THIS lead instance
                .limit(1);
            isFormFilled = !!formLogs && formLogs.length > 0;
        }

        const STAGE_SCRIPTS: Record<string, string> = {
            'In Discussion': isFormFilled
                ? `Thank you for your patience! 🙏 Our 99 Care team is already preparing your personalised quotation based on the details you shared and will send it shortly. 😊✨`
                : `Thank you for reaching out! 🙏 To prepare the most accurate quotation for you, please complete the "Fill Service Details" form we shared earlier. This helps our team understand your requirements perfectly! 😊📋`,

            'Quotation Sent': 
                `Thank you! 🙏 Please complete the consent form we shared with you so that we can move forward and assign your staff. 😊✨`,

            'Form Submitted':
                `Thank you for filling the consent form! 🙏 Our 99 Care team is now identifying the best suited care professional for your needs and will be in touch with you very shortly. 😊`,

            'Staff Assigned':
                `Your care professional has been arranged! 🙏 Our 99 Care team will contact you shortly to confirm the start date and deposit details. We're almost there! 😊✨`,

            'Deposit Pending':
                `Thank you! 🙏 Once the deposit is confirmed, your service will begin. Our 99 Care team will guide you through the final steps — please don't hesitate to reach out if you have any questions. 😊`,

            'Monthly Billing':
                `Thank you for your message! 🙏 Our 99 Care team has noted your query and will get back to you shortly. We appreciate your trust in us! 😊`,
        };

        let leadStage = earlyLead?.pipeline_stage || '';

        // Dynamic check for Quotation Sent -> Form Submitted
        if (leadStage === 'Quotation Sent' && earlyLead?.id) {
            try {
                const { data: consentData } = await supabase
                    .from('client_consents')
                    .select('id')
                    .eq('lead_id', earlyLead.id)
                    .maybeSingle();

                if (consentData) {
                    // Force update stage
                    await supabase.from('crm_leads').update({ pipeline_stage: 'Form Submitted' }).eq('id', earlyLead.id);
                    leadStage = 'Form Submitted';
                    console.log(`[Consent Check] Lead ${earlyLead.id} found in client_consents. Automatically moved to Form Submitted.`);
                }
            } catch (err) {
                console.error("[Consent Check Error]:", err);
            }
        }

        const scriptedReply = STAGE_SCRIPTS[leadStage];

        if (scriptedReply) {
            // Check if we already sent this exact scripted reply as the last message
            const lastAssistantMsg = historyData.filter(m => m.role === 'assistant').pop();

            let replyToSend = scriptedReply;

            // Loop prevention: if we already sent THIS EXACT script, send a short follow-up instead
            if (lastAssistantMsg?.content === scriptedReply) {
                console.log(`[Stage Script] Already sent "${leadStage}" script. Sending follow-up.`);
                replyToSend = `We appreciate your patience! 🙏 Our 99 Care team is actively working on your request. If you need immediate help, please call us directly. We're always here for you! 😊`;
            } else {
                console.log(`[Stage Script] Stage: "${leadStage}" — sending scripted reply.`);
            }

            if (META_SYSTEM_TOKEN && META_PHONE_ID) {
                const sendRes = await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${META_SYSTEM_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messaging_product: "whatsapp",
                        to: purePhone,
                        type: "text",
                        text: { preview_url: false, body: replyToSend }
                    })
                });
                if (!sendRes.ok) console.error(`[Stage Script Send Error] ${sendRes.status}: ${await sendRes.text()}`);
                else console.log(`[Stage Script Send OK] to ${purePhone}`);
            }

            await supabase.from('whatsapp_messages').insert([{ phone: purePhone, role: 'assistant', content: replyToSend }]);
            await supabase.from('whatsapp_logs').update({
                status: 'success',
                payload: { type: 'stage_scripted_reply', stage: leadStage, message: replyToSend, original_recipient: fromPhone }
            }).eq('sid', wamid);

            return new Response('EVENT_RECEIVED', { status: 200 });
        }


        // --- 10. RETURNING LEAD: Check for call transcript data ---
        let leadDataContext = "";
        let leadRecord: any = null;
        try {
            const { data: leadRows } = await supabase.from('crm_leads').select('*')
                .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`)
                .order('created_at', { ascending: false })
                .limit(1);
            leadRecord = leadRows?.[0] ?? null;

            const { data: callTranscripts } = await supabase.from('call_transcripts')
                .select('transcript_text, called_at, call_duration_secs')
                .like('phone_number', `%${last10}%`)
                .order('called_at', { ascending: false }).limit(3);

            if (callTranscripts && callTranscripts.length > 0) {
                const leadName = leadRecord?.name?.split('—')[0]?.trim() || 'there';
                const quotationMsg = `Namaste ${leadName} ji! 🙏\n\nWe already have your details from our recent call. Our 99 Care team is preparing your personalised quotation and will share it on this number shortly.\n\nFeel free to ask any questions in the meantime. We're always here for you! 😊✨`;

                // Loop prevention: don't send this exact message twice in a row
                const lastAssistantMsg = (historyData || []).filter((m: any) => m.role === 'assistant').pop();
                
                if (lastAssistantMsg?.content === quotationMsg) {
                    console.log(`[Call Transcript] Already sent quotation prep msg to ${purePhone}. Handing over to AI.`);
                    // Fall through to Groq AI logic below
                } else {
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
            }

            if (leadRecord) {
                const isFinished = ['Quotation Sent', 'Staff Assigned', 'Active Client', 'Closed Won'].includes(leadRecord.pipeline_stage);
                leadDataContext = `\n\n### CRM LEAD:\n- Name: ${leadRecord.name}\n- Stage: ${leadRecord.pipeline_stage}\n` +
                    `- Quoted Monthly Rate: ${leadRecord.quoted_monthly_rate || 0}\n` +
                    `- Quoted Daily Rate: ${leadRecord.quoted_daily_rate || 0}\n` +
                    (isFinished ? `### This lead is done or form filled. Be extremely brief. Reassure them the team will be in touch, then STOP asking questions.\n` : '');
            }

            if (callTranscripts && callTranscripts.length > 0) {
                const parts = (callTranscripts as any[]).map((c: any) => `--- Voice Call on ${new Date(c.called_at).toLocaleDateString('en-IN')} ---\n${c.transcript_text}`);
                leadDataContext += `\n\n### CALL TRANSCRIPTS:\n${parts.join('\n\n')}`;
            }
        } catch (err) {
            console.error("[Context Error]:", err);
        }

        // --- 10. GROQ AI FOR ONGOING CONVERSATION ---
        const systemPrompt = `You are Khushi, a warm and professional WhatsApp AI assistant for 99 Care Home Healthcare Services, Surat.
The lead has already submitted their intake form or is in an ongoing conversation.

RULES (follow strictly):
- Always refer to the business as "99 Care team".
- NEVER use the phrase "will be in touch shortly" or "get back to you shortly" — instead, specify that the "99 Care team is preparing your quotation" or "verifying your form."
- Keep ALL replies to 2-3 lines maximum.
- Use 1-2 emojis per message. Match the user's language (Hindi/Gujarati/English).
- NEVER quote prices. NEVER ask for information already collected.
- If the user's message is a GOODBYE or FAREWELL (e.g. "bye", "take care", "good night", "you too"), respond with EXACTLY: {"replyToUser": null, "pipelineStageUpdate": null}
- If the user's message is a POSITIVE REPLY or acknowledgment (e.g. "yes", "okay", "done", "sure", "proceed", "haan", "bilkul"):
    * If their CRM stage is "In Discussion": 
        * If Quoted Monthly Rate > 0: Always reply: "Thank you! 🙏 Our 99 Care team will connect with you shortly for closing on this quotation. 😊✨"
        * Otherwise: Always reply: "Thank you! 🙏 Our 99 Care team is already preparing your personalised quotation and will share it here shortly. 😊✨"
    * If their CRM stage is "Form Submitted": Reply: "Thank you! 🙏 Our 99 Care team will verify your form and assign the best suited staff shortly. 😊"
    * Otherwise: Say thank you and that the 99 Care team will get back to them soon.
- NEVER ask follow-up questions if the lead's details are already collected.

Context: ${leadDataContext}
Respond ONLY as valid JSON: {"replyToUser": "string or null", "pipelineStageUpdate": "string or null"}`;

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

        let aiReplyMsg = "Namaste! 🙏 Our 99 Care team will get back to you shortly!";
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
                // If AI explicitly returns null for replyToUser, stay silent
                if (parsed.replyToUser === null || parsed.replyToUser === undefined) {
                    console.log('[Groq] AI decided to stay silent (closing remark detected).');
                    await supabase.from('whatsapp_logs').update({
                        status: 'success',
                        payload: { type: 'ai_silent_exit', text: rawBody, original_recipient: fromPhone }
                    }).eq('sid', wamid);
                    return new Response('EVENT_RECEIVED', { status: 200 });
                }
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
