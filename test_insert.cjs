const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('client_consents').insert([{
    lead_id: '65d899a9-6fba-4778-9dd3-d477755e797a',
    phone: '1234567890',
    relative_name: 'Test',
    patient_name: 'Test',
    age: '30',
    weight: '70',
    alternate_contact_number: '1234',
    address: 'Test Addr',
    reference_by: 'Test Ref',
    service_start_date: '2023-01-01',
    service_category: 'General',
    offered_time: '10 hours',
    terms_accepted: true
  }]);
  console.log(error);
}
run();
