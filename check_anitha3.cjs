require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: workers } = await supabase.from('workers').select('id, name, monthly_daily_rate, short_term_daily_rate, preferred_payment_type, hourly_rate');
  console.log("All workers:", JSON.stringify(workers, null, 2));
}
check();
