import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const payload = await req.json();

  console.log("Status update received:", payload);

  return new Response("OK", { status: 200 });
});
