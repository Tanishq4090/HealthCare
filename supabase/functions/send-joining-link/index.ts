import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: any) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { workerId, workerName, workerPhone, appUrl } = await req.json();

        if (!workerId || !workerName || !workerPhone || !appUrl) {
            return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        // Get Twilio credentials from Supabase Environment Secrets
        const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
        const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
        const TWILIO_WHATSAPP_NUMBER = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
            throw new Error('Twilio credentials are not configured in environment variables');
        }

        // Clean the phone number (assuming typical Indian number format or international)
        // Twilio expects whatsapp:+[CountryCode][PhoneNumber]
        let cleanedPhone = workerPhone.replace(/\D/g, '');
        if (cleanedPhone.length === 10) {
            cleanedPhone = `91${cleanedPhone}`; // Default to India code if just 10 digits
        }
        const toWhatsAppNumber = `whatsapp:+${cleanedPhone}`;

        // Construct the attendance tracking link
        const dutyLink = `${appUrl}/duty/${workerId}`;

        // Create the message text
        const messageBody = `Hello ${workerName}! 👋\n\nYou have been successfully confirmed for your new assignment with 99 Care.\n\nHere is your personal daily Duty & Attendance Tracker link:\n${dutyLink}\n\nPlease click this link every day when you arrive and leave the facility to log your hours.`;

        // Prepare the request to Twilio API
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        const authString = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

        const body = new URLSearchParams({
            To: toWhatsAppNumber,
            From: TWILIO_WHATSAPP_NUMBER,
            Body: messageBody,
        });

        // Send the message via Twilio
        const response = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${authString}`,
            },
            body: body.toString(),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Twilio Error:", data);
            throw new Error(data.message || 'Failed to send WhatsApp message via Twilio');
        }

        return new Response(JSON.stringify({ success: true, messageId: data.sid }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error("Function Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
