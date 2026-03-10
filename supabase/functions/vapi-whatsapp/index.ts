import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { phone, message } = await req.json()

        // The private API key from the environment
        const VAPI_PRIVATE_KEY = Deno.env.get('VAPI_PRIVATE_KEY') || '0197acbc-564f-4a58-bb96-751566abffb8';

        // For production when Twilio is set up, the Twilio credentials will be pulled from env vars:
        const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || 'AC_PLACEHOLDER';
        const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || 'AUTH_PLACEHOLDER';
        const TWILIO_WHATSAPP_NUMBER = Deno.env.get('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+14155238886'; // Twilio sandbox number

        // In test mode with Vapi native numbers, we cannot send WhatsApp messages.
        // So we will simulate success to the frontend if the Twilio creds are placeholders.
        if (TWILIO_ACCOUNT_SID === 'AC_PLACEHOLDER') {
            console.log(`[TEST MODE] Simulating WhatsApp to ${phone} via Vapi Assistant...`);
            console.log(`Message Body: ${message}`);

            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'WhatsApp dispatched successfully (Simulated for Vapi Test Mode).',
                    dispatchedTo: phone
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                }
            )
        }

        // --- Production Twilio Dispatch ---
        console.log(`Dispatching real WhatsApp to ${phone} via Twilio API...`);

        // Format the phone number (Twilio requires e.164 and starting with 'whatsapp:')
        const formattedPhone = phone.startsWith('+') ? phone : `+${phone}`;
        const to = `whatsapp:${formattedPhone}`;

        // Ensure the From number is formatted correctly for WhatsApp
        const fromFormatted = TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:')
            ? TWILIO_WHATSAPP_NUMBER
            : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        const encodedData = new URLSearchParams({
            To: to,
            From: fromFormatted,
            Body: message
        });

        const twilioResponse = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: encodedData
        });

        const twilioResult = await twilioResponse.json();

        if (!twilioResponse.ok) {
            throw new Error(`Twilio API Error: ${twilioResult.message}`);
        }

        // Returning success to the CRM frontend
        return new Response(
            JSON.stringify({
                success: true,
                message: 'WhatsApp dispatched successfully.',
                sid: twilioResult.sid,
                dispatchedTo: phone
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )
    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
