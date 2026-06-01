require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: leads } = await supabase.from('crm_leads').select('*, client_consents(*)').ilike('name', '%Janvi%');
  console.log(JSON.stringify(leads, null, 2));
}
main();
