import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async () => {
    // Wait, supabase-js does not support running raw DDL (like ALTER TABLE). 
    // It requires using `.rpc()` which means a postgres function needs to exist.
    return new Response("OK");
});
