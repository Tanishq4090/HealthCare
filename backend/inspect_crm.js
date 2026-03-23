import { supabase } from './services/supabase.js';

async function inspectCRM() {
  console.log('--- Inspecting Supabase CRM Leads Table ---');
  try {
    const { data, error } = await supabase
      .from('crm_leads')
      .select('*')
      .limit(1);

    if (error) {
       console.error('❌ SELECT FAILED:', error.message);
       return;
    }

    if (data && data.length > 0) {
      console.log('✅ Found record. Columns:', Object.keys(data[0]));
      console.log('Sample data:', data[0]);
    } else {
      console.log('ℹ️ Table is empty.');
    }
  } catch (err) {
    console.error('💥 UNEXPECTED ERROR:', err);
  }
}

inspectCRM();
