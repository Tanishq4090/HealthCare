import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

serve(async (req) => {
    // Handle CORS for ElevenLabs
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    try {
        const { phone, stage } = await req.json();
        
        console.log(`[ElevenLabs CRM Tool] Updating ${phone} to ${stage}`);

        if (!phone || !stage) {
            return new Response(JSON.stringify({ error: "Missing phone or stage" }), { status: 400 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        const purePhone = phone.replace(/\D/g, '').slice(-10); // Extract last 10 digits

        const { error } = await supabase
            .from('crm_leads')
            .update({ pipeline_stage: stage })
            .like('whatsapp_number', `%${purePhone}%`);

        if (error) {
            console.error("Supabase Error:", error);
            return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
        }

        return new Response(JSON.stringify({ success: true, message: `Lead updated to ${stage}` }), {
            headers: { "Content-Type": "application/json" },
            status: 200
        });

    } catch (error: any) {
        console.error("[Tool Error]", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
});
