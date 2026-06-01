require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: consents, error } = await supabase.from('client_consents').select('*').eq('lead_id', '00aa8da4-0dfa-4424-988c-0c21b854f594');
  console.log(error || JSON.stringify(consents, null, 2));
}
main();
