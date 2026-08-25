import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
     const { data } = await supabase.from('clients').select('id, client_name').eq('id', 'a78fee96-053a-4b9a-864e-093466451957');
     console.log('Client:', data);
     
     // Also check what the error is manually inserting a service for this lead
     const { error } = await supabase.from('services').insert({
         client_id: 'a78fee96-053a-4b9a-864e-093466451957',
         lead_id: 'a78fee96-053a-4b9a-864e-093466451957',
         service_type: 'one_day',
         hours_per_day: 12,
         start_date: '2026-08-27'
     });
     console.log('Insert Service Error:', error);
}
check();
