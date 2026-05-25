const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_URL_HERE';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_KEY_HERE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('crm_leads').select('id, name, client_consents(*)').eq('whatsapp_number', '918000044090');
  console.log(JSON.stringify(data, null, 2));
}
run();
