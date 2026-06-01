require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data, error } = await supabase.from('client_consents').insert([{
    lead_id: '00aa8da4-0dfa-4424-988c-0c21b854f594',
    phone: '917600004090',
    relative_name: 'Janvi', // guessing from lead name
    patient_name: 'Tina Kachiwala', // from activity log
    age: '',
    weight: '',
    contact_number: '917600004090',
    alternate_contact_number: '',
    address: '395003, Surat, Gujarat, India',
    reference_by: '',
    service_start_date: '2026-05-31',
    service_category: 'Old Age Care',
    offered_time: '24-Hour Shift',
    terms_accepted: true
  }]);
  console.log(error || "Success fixing Janvi!");
}
main();
