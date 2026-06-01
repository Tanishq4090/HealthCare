require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: activity } = await supabase.from('crm_lead_activity').select('*').eq('lead_id', '00aa8da4-0dfa-4424-988c-0c21b854f594').order('created_at');
  console.log(JSON.stringify(activity, null, 2));
}
main();
