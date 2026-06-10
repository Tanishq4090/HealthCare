import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const last10 = '8000044090';
  const { data: leads } = await supabase
        .from('crm_leads')
        .select('id, name, phone')
        .or(`phone.ilike.%${last10}%,whatsapp_number.ilike.%${last10}%`)
        .order('created_at', { ascending: false })
        .limit(1);

  if (leads && leads.length > 0) {
    const { data, error } = await supabase.from('client_work_forms').insert([{
        lead_id: leads[0].id,
        form_type: 'patient_care_form',
        patient_name: 'Test',
        duties: ['Duty 1', 'Duty 2'],
        other_work: 'Test other work'
    }]).select();
    console.log('Insert Error:', error);
    console.log('Insert Data:', data);
  } else {
    console.log('Lead not found');
  }
}
run();
