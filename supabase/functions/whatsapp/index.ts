import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const body = await req.text();

  console.log("Incoming WhatsApp message:", body);

  return new Response("OK", { status: 200 });
});
