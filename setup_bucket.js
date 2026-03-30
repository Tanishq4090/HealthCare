import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import "https://deno.land/x/dotenv/load.ts";

const supabase = createClient(
  Deno.env.get("VITE_SUPABASE_URL"),
  Deno.env.get("VITE_SUPABASE_ANON_KEY")
); // wait, need service key for bucket creation. anon key might fail RLS.
