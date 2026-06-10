import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const last10 = '8000044090';
  const { data: leads } = await supabase
        .from('crm_leads')
        .select('id, name, phone, whatsapp_number')
        .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`)
        .order('created_at', { ascending: false });

  console.log('Leads found via last10:', leads);
}
run();
