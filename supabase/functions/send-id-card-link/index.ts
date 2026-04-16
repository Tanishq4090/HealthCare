import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extremely simple in-memory rate limiter per IP/user for the Edge Function worker
// Note: This resets when the Deno worker is recycled. Use Redis for a strict distributed rate limit.
const rateLimiter = new Map<string, { count: number, resetAt: number }>();

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Verify Authentication (check Authorization header with Supabase JWT)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Server misconfiguration: Missing Supabase url/key');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 3. Rate limit: max 10 messages per minute per user
    const now = Date.now();
    const userId = user.id;
    let limitData = rateLimiter.get(userId);

    if (!limitData || limitData.resetAt < now) {
        limitData = { count: 0, resetAt: now + 60 * 1000 };
    }
    
    if (limitData.count >= 10) {
        return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded: max 10 messages per minute' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    
    limitData.count += 1;
    rateLimiter.set(userId, limitData);

    // 4. Parse and validate payload
    const payload = await req.json();
    const { phoneNumber, employeeName, jobTitle, shareableUrl } = payload;

    if (!phoneNumber || !employeeName || !jobTitle || !shareableUrl) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Server-side environment variables loaded securely
    const META_SYSTEM_TOKEN = Deno.env.get('META_SYSTEM_TOKEN');
    // Using META_PHONE_NUMBER_ID or falling back to META_PHONE_ID for compatibility
    const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID') || Deno.env.get('META_PHONE_ID');

    if (!META_SYSTEM_TOKEN || !META_PHONE_NUMBER_ID) {
      throw new Error("Missing Meta Credentials in Secrets!");
    }

    // 5. Sanitize phone number inputs (strip non-digits, ensure country code)
    const digits = phoneNumber.replace(/\D/g, '');
    const to = digits.startsWith('91') ? digits : `91${digits.slice(-10)}`;

    if (to.length < 10) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid phone number format' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // 6. Construct message body
    const messageBody =
      `Hello! A healthcare worker has been assigned to you.\n\n` +
      `👤 Name: ${employeeName}\n` +
      `💼 Role: ${jobTitle}\n\n` +
      `🔗 View their verified ID Card: ${shareableUrl}\n\n` +
      `Please verify their identity upon arrival. This link expires in 30 days.\n\n` +
      `— HealthCare CRM`;

    // 7. Send to Meta WhatsApp API
    const metaUrl = `https://graph.facebook.com/v21.0/${META_PHONE_NUMBER_ID}/messages`;
    const metaResponse = await fetch(metaUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${META_SYSTEM_TOKEN}`, // Never logged
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { 
            preview_url: true, // Enables URL preview in WhatsApp
            body: messageBody 
        },
      }),
    });

    const metaData = await metaResponse.json();

    if (!metaResponse.ok) {
        const detail = metaData?.error?.message ?? metaResponse.statusText;
        return new Response(JSON.stringify({ success: false, error: `WhatsApp API error: ${detail}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const messageId = metaData.messages?.[0]?.id || 'unknown';

    // Return success
    return new Response(JSON.stringify({ success: true, messageId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Internal Error processing send-id-card-link:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
