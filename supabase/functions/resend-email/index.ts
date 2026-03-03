import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS for browser preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Parse the incoming request body
        const { to, subject, html, text } = await req.json()

        // Get the API key from Supabase Secrets
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

        if (!RESEND_API_KEY) {
            throw new Error("Missing RESEND_API_KEY environment variable")
        }

        // Call the Resend API
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: 'HealthFirst AI <onboarding@resend.dev>', // The default sandbox email provided by Resend
                to: Array.isArray(to) ? to : [to], // Resend expects an array for 'to'
                subject: subject,
                html: html,
                text: text
            })
        })

        const data = await res.json()

        // Resend returns an 'id' on success, and a message/name on failure
        if (!res.ok) {
            console.error("Resend Error Context:", data);
            throw new Error(data.message || "Failed to send email via Resend");
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
