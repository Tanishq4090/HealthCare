import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const DEFAULT_PLACE_ID = 'ChIJnbC9IuxN4DsRXEWEnUc0HF8';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY') || Deno.env.get('GOOGLE_PLACES_API_KEY');
    const placeId = Deno.env.get('GOOGLE_PLACE_ID') || DEFAULT_PLACE_ID;

    if (!apiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'GOOGLE_MAPS_API_KEY is not configured.',
        placeId,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fields = [
      'id',
      'displayName',
      'rating',
      'userRatingCount',
      'reviews',
      'googleMapsUri',
    ].join(',');

    const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fields,
        'Accept-Language': 'en-IN,en',
      },
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: data?.error?.message || `Google Places returned HTTP ${response.status}`,
        details: data,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reviews = (data.reviews || []).map((review: any) => ({
      name: review.authorAttribution?.displayName || 'Google user',
      photoUri: review.authorAttribution?.photoUri || null,
      uri: review.authorAttribution?.uri || null,
      rating: review.rating || 0,
      text: review.text?.text || review.originalText?.text || '',
      relativePublishTimeDescription: review.relativePublishTimeDescription || '',
      publishTime: review.publishTime || null,
    }));

    return new Response(JSON.stringify({
      success: true,
      placeId,
      displayName: data.displayName?.text || '99 Care',
      rating: data.rating || 0,
      userRatingCount: data.userRatingCount || 0,
      googleMapsUri: data.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${placeId}`,
      reviews,
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load Google reviews.',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
