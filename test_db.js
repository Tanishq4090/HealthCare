import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: lead } = await supabase
    .from('crm_leads')
    .select('id, name, assigned_worker_name')
    .eq('whatsapp_number', '918000044090');
    
  for(const l of lead || []) {
     const { data: srv } = await supabase.from('services').select('*, service_worker_assignments(*)').eq('client_id', l.id);
     console.log(`Services for ${l.id} (${l.assigned_worker_name}):`, JSON.stringify(srv, null, 2));
  }
}
check();
