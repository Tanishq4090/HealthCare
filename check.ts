import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

async function check() {
  const { data } = await supabase.from('crm_leads').select('id, name, phone, whatsapp_number, pipeline_stage, created_at').order('created_at', { ascending: false }).limit(10);
  console.log(JSON.stringify(data, null, 2));
}

check();
