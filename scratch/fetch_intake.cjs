require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: activity } = await supabase.from('crm_lead_activity').select('*').eq('event_type', 'form_filled').eq('lead_id', '00aa8da4-0dfa-4424-988c-0c21b854f594').order('created_at');
  
  const intakeForm = activity.find(a => a.description.includes('Intake form'));
  if (intakeForm) {
      console.log("Intake Form Metadata:", JSON.stringify(intakeForm.metadata, null, 2));
      
      const { error } = await supabase.from('client_consents').update({
          address: intakeForm.metadata.location || '395003, Surat, Gujarat, India',
          relative_name: intakeForm.metadata.lead_name || 'Jaanvi',
          service_start_date: intakeForm.metadata.start_date || '2026-05-31'
      }).eq('lead_id', '00aa8da4-0dfa-4424-988c-0c21b854f594');
      
      console.log(error || "Updated consent with intake data");
  }
}
main();
