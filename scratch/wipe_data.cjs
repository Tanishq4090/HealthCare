const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: clients, error: cErr } = await supabase.from('clients').select('id').limit(1);
  console.log("Clients fetch:", clients ? clients.length : cErr);

  const { data: leads, error: lErr } = await supabase.from('crm_leads').select('id').limit(1);
  console.log("Leads fetch:", leads ? leads.length : lErr);
}
check();
