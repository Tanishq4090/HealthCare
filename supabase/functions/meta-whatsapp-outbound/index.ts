import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function shiftLabelToFlowId(label: string): string {
  const h = (label || '').toLowerCase();
  if (/\b24/.test(h)) return '24-Hour Shift';
  return '10-Hour Shift';
}

function normalizeConsentOfferedTime(value: unknown): string {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.includes('24') || raw.includes('live')) return '24 Hours (Live-in)';
  if (raw.includes('10') || raw.includes('12') || raw.includes('day') || raw.includes('night')) return '10 Hours';
  return raw ? 'Other' : '';
}

const CONSENT_FLOW_KEYS = new Set([
  'relative_name',
  'patient_name',
  'age',
  'weight',
  'contact_number',
  'alternate_contact_number',
  'address',
  'reference_by',
  'service_start_date',
  'service_category',
  'offered_time',
  'other_details',
]);

function isUsablePersonName(value: string): boolean {
  const t = (value || '').trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  return lower !== 'there' && lower !== 'unknown lead';
}

function resolveConsentRelativeName(
  flowData: unknown,
  bodyParams: { text: string }[],
  leadName?: string,
  leadFullName?: string,
  leadNotes?: string,
): string {
  const careFor = (leadNotes || '').match(/Care for:\s*(.+)/i)?.[1]?.trim() || '';
  const candidates = [
    (leadFullName || '').trim(),
    flowData && typeof flowData === 'object'
      ? String((flowData as Record<string, unknown>).relative_name || '').trim()
      : '',
    careFor,
    (leadName || '').trim(),
    bodyParams[0]?.text?.trim() || '',
  ];

  for (const name of candidates) {
    if (isUsablePersonName(name)) return name;
  }
  return '';
}

/** flow_action_data: screen + data keys (no empty strings — Meta ignores empty prefill). */
function buildConsentFlowPayload(
  flowData: unknown,
  bodyParams: { text: string }[],
  leadName?: string,
  leadFullName?: string,
  leadNotes?: string,
): Record<string, string> {
  const out: Record<string, string> = {};

  if (flowData && typeof flowData === 'object') {
    for (const [key, val] of Object.entries(flowData as Record<string, unknown>)) {
      if (key === 'screen' || !CONSENT_FLOW_KEYS.has(key) || val == null || val === '') continue;
      out[key] = key === 'offered_time' ? normalizeConsentOfferedTime(val) : String(val);
    }
  }

  const relativeName = resolveConsentRelativeName(
    flowData,
    bodyParams,
    leadName,
    leadFullName,
    leadNotes,
  );
  if (relativeName) out.relative_name = relativeName;

  // Meta template flow button: screen id + non-empty data object
  return {
    screen: 'CONSENT_SCREEN',
    ...out,
  };
}

/** Build INTAKE_FORM screen data for flow_action_data (keys must match Flow JSON `data` schema). */
function buildIntakeFlowPayload(
  flowData: unknown,
  bodyParams: { text: string }[],
  leadName?: string,
): Record<string, string> {
  const out: Record<string, string> = {
    country: 'India',
    state: 'Gujarat',
    city: 'Surat',
    shift_type: '10-Hour Shift',
  };

  if (flowData && typeof flowData === 'object') {
    for (const [key, val] of Object.entries(flowData as Record<string, unknown>)) {
      if (key === 'screen' || val == null || val === '') continue;
      out[key] = String(val);
    }
  }

  const firstName = bodyParams[0]?.text?.trim();
  const serviceText = bodyParams[1]?.text?.trim();
  const shiftText = bodyParams[2]?.text?.trim();

  const fromClient = flowData && typeof flowData === 'object' ? (flowData as Record<string, unknown>) : {};
  if (!out.name && firstName && firstName !== 'there') out.name = firstName;
  if (!fromClient.service && serviceText && !['home healthcare', 'general'].includes(serviceText.toLowerCase())) {
    out.service = serviceText;
  }
  if (!fromClient.shift_type && shiftText && shiftText.toLowerCase() !== 'general') {
    out.shift_type = shiftLabelToFlowId(shiftText);
  }
  if (leadName?.trim() && !out.name) out.name = leadName.trim();

  return out;
}

serve(async (req) => {
  const url = new URL(req.url);

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // --- META WEBHOOK VERIFICATION (GET hub.challenge) ---
  if (req.method === 'GET' && url.searchParams.has('hub.mode')) {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    // Configured via Supabase secrets
    const META_VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN') || '99care_meta_webhook';

    if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
      console.log('Webhook verified successfully!');
      return new Response(challenge, { status: 200 });
    } else {
      return new Response('Forbidden', { status: 403 });
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // --- META STATUS CALLBACK / INCOMING MESSAGE (POST) ---
  if (req.method === 'POST') {
    try {
      const body = await req.json();

      // Ensure this is a Meta payload
      if (body.object === 'whatsapp_business_account' && body.entry && body.entry.length > 0) {
        const entry = body.entry[0];
        
        if (entry.changes && entry.changes.length > 0) {
          const value = entry.changes[0].value;

          // 1. WhatsApp Delivery Status Reports Context
          if (value.statuses && value.statuses.length > 0) {
            const statusObj = value.statuses[0];
            const wamid = statusObj.id;
            const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
            
            // Meta webhooks are isolated. We match by 'sid' (which stores the Meta message ID).
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

          // 2. Incoming Messages
          if (value.messages && value.messages.length > 0) {
            // Usually, whatsapp-elevenlabs-bot handles inbound, but if Meta sends it here, just ack it.
            return new Response('EVENT_RECEIVED', { status: 200 });
          }
        }
      }
      
      // If it wasn't a Meta Webhook payload, the JSON parse might have been the CRM dispatch!
      // In that case, we MUST let it fall through to the OUTBOUND logic below.
      // So we attach the parsed body to the request object to mock reading it again.
      (req as any).crm_payload = body;
      
    } catch (e: any) {
      if (!e.message.includes('Unexpected end of JSON')) {
          console.error("Webhook processing error:", e);
      }
    }
  }

  // --- OUTBOUND: MESSAGE DISPATCH FROM CRM ---
  try {
    let payload;
    if ((req as any).crm_payload && (req as any).crm_payload.phone) {
        payload = (req as any).crm_payload;
    } else {
        // Fallback if not caught by POST webhook try/catch above
        try {
            payload = await req.json();
        } catch {
            return new Response('ok', { status: 200, headers: corsHeaders }); 
        }
    }

    if (!payload || !payload.phone) {
        // Just an empty ping or unhandled webhook structure
        return new Response('ok', { status: 200, headers: corsHeaders });
    }

    const { phone, leadName, leadFullName, message, useTemplate, leadId, templateName, templateParams, sendFlow, flowId, flowData, sendInvoicePdf, invoicePdfUrl } = payload;
    if (useTemplate && templateName === 'greeting_msg') {
      throw new Error('Blocked deprecated greeting_msg template. Use lead-scoped post_call_intake instead.');
    }
    const META_SYSTEM_TOKEN = Deno.env.get('META_SYSTEM_TOKEN');
    const META_PHONE_ID = Deno.env.get('META_PHONE_ID');

    if (!META_SYSTEM_TOKEN || !META_PHONE_ID) {
        throw new Error("Missing Meta Credentials in Secrets!");
    }

    let digits = phone.replace(/\D/g, ''); 
    if (digits.length === 10) digits = `91${digits}`; // Standardize to 91 prefix for Indian numbers if not present
    
    // Meta payload structure
    const metaBody: any = {
      "messaging_product": "whatsapp",
      "recipient_type": "individual",
      "to": digits,
    };

    if (useTemplate) {
      metaBody.type = "template";
      
      const parameters = [];
      if (templateParams && Array.isArray(templateParams) && templateParams.length > 0) {
          const safeDefaults = ['there', 'Home Healthcare', 'General'];
          for (let i = 0; i < templateParams.length; i++) {
              const val = templateParams[i];
              parameters.push({
                  type: "text",
                  text: (val && val.trim()) ? val.trim() : safeDefaults[i] || '...'
              });
          }
      } else if (templateName === "quote_client_v2") {
          // Send the entire structured message as the first parameter
          parameters.push({
              type: "text",
              text: (message || "Here is your quotation.").trim()
          });
      } else if (templateName === "post_call_intake" || !templateName) {
          // Fallback to post_call_intake parameter
          parameters.push({
              type: "text",
              text: leadName ? leadName.trim() : 'there'
          });
      }

      // Ensure post_call_intake and staff_assignment always have exactly 3 parameters to prevent Meta API Error 132000
      if (templateName === "post_call_intake" || templateName === "staff_assignment" || !templateName) {
          const safeDefaults = ['there', 'Home Healthcare', 'General'];
          while (parameters.length < 3) {
              parameters.push({
                  type: "text",
                  text: safeDefaults[parameters.length]
              });
          }
      }

      const components: any[] = [];
      
      if (templateName === "deposit_request" || templateName === "client_monthly_invoice") {
          components.push({
            type: "header",
            parameters: [
              {
                type: "image",
                image: {
                  link: "https://sgyladamwnanudnropwl.supabase.co/storage/v1/object/public/invoices/payment-qr.JPG"
                }
              }
            ]
          });
      }
      
      if (templateName === "worker_payslip" && payload.sendInvoicePdf && payload.invoicePdfUrl) {
          components.push({
            type: "header",
            parameters: [
              {
                type: "document",
                document: {
                  link: payload.invoicePdfUrl,
                  filename: "Worker_Payslip.pdf"
                }
              }
            ]
          });
      }

      if (parameters.length > 0) {
          components.push({
            type: "body",
            parameters: parameters
          });
      }

      // Add flow button to post_call_intake or consent_form templates
      const FLOW_ID = Deno.env.get('WHATSAPP_FLOW_ID');
      const BABY_CARE_FLOW_ID = Deno.env.get('BABY_CARE_FLOW_ID');
      const PATIENT_CARE_FLOW_ID = Deno.env.get('PATIENT_CARE_FLOW_ID');

      if ((templateName === "post_call_intake" || templateName === "consent_form") && FLOW_ID) {
        let consentLeadFullName = (leadFullName || '').trim();
        let consentLeadNotes = '';
        if (templateName === "consent_form" && leadId) {
          const { data: leadRow } = await supabase
            .from('crm_leads')
            .select('name, notes')
            .eq('id', leadId)
            .maybeSingle();
          const dbName = (leadRow?.name || '').trim();
          if (isUsablePersonName(dbName)) consentLeadFullName = dbName;
          consentLeadNotes = (leadRow?.notes || '').trim();
        }

        const actionPayload: Record<string, unknown> = {
          flow_token: `flow_${digits}_${Date.now()}`,
        };

        if (templateName === "post_call_intake") {
          actionPayload.flow_action_data = {
            screen: 'INTAKE_FORM',
            ...buildIntakeFlowPayload(flowData, parameters, leadName),
          };
        } else {
          actionPayload.flow_action_data = buildConsentFlowPayload(
            flowData,
            parameters,
            leadName,
            consentLeadFullName || leadFullName,
            consentLeadNotes,
          );
          const consentActionData = actionPayload.flow_action_data as Record<string, string>;
          console.log(
            `[Meta] Consent flow_action_data screen=${consentActionData?.screen} relative_name=${consentActionData?.relative_name || '(empty)'}`,
          );
        }

        components.push({
          type: "button",
          sub_type: "flow",
          index: "0",
          parameters: [
            {
              type: "action",
              action: actionPayload
            }
          ]
        });
      }

      // Add flow button for Baby Care Work Form
      if (templateName === "baby_care_form" && BABY_CARE_FLOW_ID) {
        const actionPayload: Record<string, unknown> = {
          flow_token: `flow_${digits}_${Date.now()}`,
          flow_action_data: {
            screen: 'BABY_CARE_FORM',
            baby_name: String(flowData?.baby_name || ''),
            date: String(flowData?.date || ''),
            time: String(flowData?.time || ''),
            duties: [],
            other_work: '',
            agreement: [],
          }
        };
        console.log(`[Meta] Baby Care flow_action_data:`, JSON.stringify(actionPayload.flow_action_data));
        components.push({
          type: "button",
          sub_type: "flow",
          index: "0",
          parameters: [{ type: "action", action: actionPayload }]
        });
      }

      // Add flow button for Patient Care Work Form
      if (templateName === "patient_care_form" && PATIENT_CARE_FLOW_ID) {
        const actionPayload: Record<string, unknown> = {
          flow_token: `flow_${digits}_${Date.now()}`,
          flow_action_data: {
            screen: 'PATIENT_CARE_FORM',
            full_name: String(flowData?.full_name || flowData?.patient_name || ''),
            duties: [],
            other_work: '',
            agreement: [],
          }
        };
        console.log(`[Meta] Patient Care flow_action_data:`, JSON.stringify(actionPayload.flow_action_data));
        components.push({
          type: "button",
          sub_type: "flow",
          index: "0",
          parameters: [{ type: "action", action: actionPayload }]
        });
      }

      metaBody.template = {
        name: templateName || "post_call_intake", 
        language: {
          code: "en"
        },
        components: components
      };
    } else {
      metaBody.type = "text";
      metaBody.text = {
        preview_url: false,
        body: message || ''
      };
    }

    console.log(`[Meta] Dispatching to ${digits} using template: ${templateName || 'None'}`);
    console.log(`[Meta] Payload: ${JSON.stringify(metaBody, null, 2)}`);

    // If a generic invoice PDF is requested, send client_invoice_pdf first.
    // Worker payslips attach their document directly to the worker_payslip template above.
    if (sendInvoicePdf && invoicePdfUrl && templateName !== "worker_payslip") {
      console.log(`[Meta] Sending client_invoice_pdf template to ${digits}. URL: ${invoicePdfUrl}`);
      const pdfTemplateBody = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: digits,
        type: "template",
        template: {
          name: "client_invoice_pdf",
          language: { code: "en" },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "document",
                  document: {
                    link: invoicePdfUrl,
                    filename: "99Care_Invoice.pdf"
                  }
                }
              ]
            }
          ]
        }
      };
      const pdfResp = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${META_SYSTEM_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pdfTemplateBody),
      });
      const pdfResText = await pdfResp.text();
      console.log(`[Meta] PDF Template Response Status: ${pdfResp.status}`);
      console.log(`[Meta] PDF Template Response Body: ${pdfResText}`);
      // Small delay so PDF template arrives before the payment template
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const response = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${META_SYSTEM_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaBody),
    });

    const resText = await response.text();
    console.log(`[Meta] Response Status: ${response.status}`);
    console.log(`[Meta] Response Body: ${resText}`);

    let metaData: any = {};
    try { metaData = JSON.parse(resText); } catch(e) {}
    
    // ── Thorough error detection ──────────────────────────────────────────
    // Meta can return errors in multiple ways:
    // 1. HTTP 4xx/5xx with { error: { message, code, type } }
    // 2. HTTP 200 but with { error: {...} } in body (rare but happens)
    // 3. HTTP 200 but missing 'messages' array (template rejected/paused)
    const metaError = metaData.error;
    const hasMessages = metaData.messages && metaData.messages.length > 0;
    const isActualSuccess = response.ok && hasMessages && !metaError;

    if (isActualSuccess) {
        const wamid = metaData.messages[0].id;
        
        // Log successful acceptance for tracking in CRM
        await supabase.from('whatsapp_logs').insert({
            sid: wamid,
            status: 'accepted_by_meta',
            payload: { 
                ...metaData, 
                lead_id: leadId, 
                original_recipient: digits,
                templateName,
                useTemplate,
                message,
                flowData: flowData || null,
            }
        });

        // Insert into whatsapp_messages to show up in the CRM chat history viewer
        if (message) {
            await supabase.from('whatsapp_messages').insert([{ 
                phone: digits, 
                role: 'assistant', 
                content: message 
            }]);
        }

        return new Response(JSON.stringify({ success: true, ...metaData }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } else {
        // Build a clear error message for the CRM
        const errorMsg = metaError 
            ? `Meta API Error ${metaError.code || ''}: ${metaError.message || metaError.error_data?.details || 'Unknown error'}` 
            : `Meta returned HTTP ${response.status} without a message ID. Template may be paused or rejected.`;
        
        console.error(`[Outbound] DELIVERY FAILED: ${errorMsg}`);

        // Log the failure for auditing
        await supabase.from('whatsapp_logs').insert({
            sid: `error_${digits}_${Date.now()}`,
            status: 'failed',
            error_code: metaError?.code?.toString() || response.status.toString(),
            error_message: errorMsg,
            payload: { 
                meta_response: metaData,
                lead_id: leadId, 
                original_recipient: digits,
                templateName,
                useTemplate,
                templateParams,
                message,
                flowData: flowData || null,
            }
        });

        return new Response(JSON.stringify({ 
            success: false, 
            error: errorMsg,
            meta_error_code: metaError?.code,
            meta_status: response.status 
        }), {
          status: 200, // Return 200 to avoid Supabase edge function errors, but success: false
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (error: any) {
    console.error("Internal Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
