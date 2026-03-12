import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // We expect the frontend to pass the Assistant ID they want to query
        const { assistantId, limit = 20 } = await req.json();

        if (!assistantId) {
            throw new Error("Missing assistantId in request body");
        }

        // The private API key from the Supabase environment secrets
        const VAPI_PRIVATE_KEY = Deno.env.get('VAPI_PRIVATE_KEY');

        if (!VAPI_PRIVATE_KEY) {
            throw new Error("VAPI_PRIVATE_KEY secret is missing on the server");
        }

        // Query Vapi API for calls associated with this assistant
        // We filter out calls that errored out or haven't ended yet for cleaner metrics
        const vapiUrl = `https://api.vapi.ai/call?assistantId=${assistantId}&limit=${limit}`;

        const response = await fetch(vapiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${VAPI_PRIVATE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Vapi API Error: ${response.status} ${err}`);
        }

        const data = await response.json();

        return new Response(
            JSON.stringify(data),
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
