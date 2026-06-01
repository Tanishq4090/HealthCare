require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: logs, error } = await supabase
    .from('whatsapp_logs')
    .select('payload')
    .ilike('payload->>original_recipient', '%7600004090%')
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (error) {
    console.error(error);
  } else {
    // Also try checking for just the raw incoming payload
    const { data: logs2 } = await supabase
      .from('whatsapp_logs')
      .select('payload, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
      
    const matches = logs2.filter(l => 
        JSON.stringify(l.payload).includes('7600004090') && 
        JSON.stringify(l.payload).includes('nfm_reply')
    );
    console.log(JSON.stringify(matches, null, 2));
  }
}
main();
