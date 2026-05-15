import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const META_SYSTEM_TOKEN = Deno.env.get('META_SYSTEM_TOKEN');
const META_PHONE_ID = Deno.env.get('META_PHONE_ID');

serve(async (req) => {
    try {
        // Only accept POST requests (or GET for testing)
        if (req.method !== 'POST' && req.method !== 'GET') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // 1. Find leads in 'In Discussion' stage
        // We look for leads where the form was filled > 2 hours ago, but we can approximate this
        // by looking at leads in 'In Discussion' created/updated > 2 hours ago.
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        
        const { data: leads, error } = await supabase
            .from('crm_leads')
            .select('id, name, phone, whatsapp_number')
            .eq('pipeline_stage', 'In Discussion')
            .lte('created_at', twoHoursAgo); // Assume if it's still here after 2 hrs, quote hasn't been sent

        if (error) throw error;
        if (!leads || leads.length === 0) {
            return new Response(JSON.stringify({ success: true, message: "No leads need follow-up." }), { status: 200, headers: { 'Content-Type': 'application/json' }});
        }

        let sentCount = 0;

        for (const lead of leads) {
            const purePhone = lead.whatsapp_number || lead.phone;
            if (!purePhone) continue;
            
            // Check if we already sent a follow-up to this lead to prevent spamming
            const { data: existingLog } = await supabase
                .from('whatsapp_logs')
                .select('id')
                .eq('payload->>type', 'scheduled_followup')
                .or(`payload->>'original_recipient'.ilike.%${purePhone.slice(-10)}%`)
                .limit(1);
                
            if (existingLog && existingLog.length > 0) {
                // Already followed up
                continue;
            }

            const firstName = lead.name.split(' ')[0] || 'there';
            const followupMsg = `Hi ${firstName}! 🙏 Just checking in — our 99 Care team is finalizing your quotation and will share it very shortly. Don't hesitate to reply if you have any questions! 😊`;

            if (META_SYSTEM_TOKEN && META_PHONE_ID) {
                const res = await fetch(`https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${META_SYSTEM_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messaging_product: "whatsapp",
                        to: purePhone,
                        type: "text",
                        text: { body: followupMsg }
                    })
                });

                if (res.ok) {
                    await supabase.from('whatsapp_messages').insert([{ phone: purePhone, role: 'assistant', content: followupMsg }]);
                    await supabase.from('whatsapp_logs').insert([{
                        sid: `followup_${Date.now()}_${lead.id}`, 
                        status: 'success',
                        payload: { type: 'scheduled_followup', lead_id: lead.id, original_recipient: purePhone }
                    }]);
                    sentCount++;
                }
            }
        }

        return new Response(JSON.stringify({ success: true, sentCount }), { status: 200, headers: { 'Content-Type': 'application/json' }});

    } catch (err: any) {
        console.error("Scheduled Followup Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' }});
    }
});
