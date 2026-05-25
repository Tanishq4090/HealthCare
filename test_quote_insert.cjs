const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('crm_quotations').insert([{
    lead_id: '65d899a9-6fba-4778-9dd3-d477755e797a',
    service_name: 'Test',
    service_category: 'Test',
    recipient_age_condition: 'Test',
    hours_per_day: 10,
    days_per_week: 7,
    shift_type: 'Day shift',
    start_date: '2023-01-01',
    end_date: '2023-01-31',
    duration: '1 month',
    complete_month_rate: 100,
    incomplete_month_rate: 100,
    estimated_monthly_total: 100,
    inclusions: [],
    message_template: 'default',
    language: 'english'
  }]);
  console.log(error);
}
run();
