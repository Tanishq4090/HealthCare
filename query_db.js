import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('crm_leads').select('name, phone, whatsapp_number, work_form_data').or('phone.eq.918000044090,whatsapp_number.eq.918000044090,phone.eq.+918000044090,whatsapp_number.eq.+918000044090');
  console.log(JSON.stringify({ data, error }, null, 2));
}
check();
