require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  console.log("Checking workers...");
  const { data: workers } = await supabase.from('workers').select('*').ilike('name', '%Anitha%');
  console.log("Workers:", JSON.stringify(workers, null, 2));

  console.log("Checking payroll...");
  const { data: payroll } = await supabase.from('payroll').select('*').ilike('worker', '%Anitha%');
  console.log("Payroll:", JSON.stringify(payroll, null, 2));
}
check();
