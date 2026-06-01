require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: logs } = await supabase
    .from('whatsapp_logs')
    .select('payload, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
    
  const matches = logs.filter(l => 
      JSON.stringify(l.payload).includes('nfm_reply') && 
      JSON.stringify(l.payload).includes('Tina Kachiwala')
  );
  console.log(JSON.stringify(matches, null, 2));
}
main();
