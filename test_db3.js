import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
     const { data, error } = await supabase.from('services').insert({
         client_id: 'a78fee96-053a-4b9a-864e-093466451957',
         lead_id: 'a78fee96-053a-4b9a-864e-093466451957',
         service_type: 'date_range',
         hours_per_day: 12,
         start_date: '2026-08-27',
         end_date: '',
         status: 'active',
         deposit_amount: 0,
         deposit_status: 'pending',
         complete_month_daily_rate: 850,
         incomplete_month_daily_rate: 1500,
         legacy_assignment_id: null
     });
     console.log('Insert Service Error:', error);
}
check();
