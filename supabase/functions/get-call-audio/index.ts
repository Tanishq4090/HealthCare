import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const conversationId = url.searchParams.get('conversation_id');

    if (!conversationId) {
      return new Response(JSON.stringify({ error: 'conversation_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Proxy the audio from ElevenLabs
    const audioRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
      { headers: { 'xi-api-key': ELEVENLABS_API_KEY } }
    );

    if (!audioRes.ok) {
      const errText = await audioRes.text();
      console.error(`[ElevenLabs Audio] ${audioRes.status}: ${errText}`);
      return new Response(JSON.stringify({ error: `ElevenLabs error: ${audioRes.status}` }), {
        status: audioRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Stream the audio back to the browser
    const contentType = audioRes.headers.get('content-type') || 'audio/mpeg';
    const audioBody = await audioRes.arrayBuffer();

    return new Response(audioBody, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="call_${conversationId}.mp3"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (err: any) {
    console.error('[get-call-audio] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
