require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('payroll').select('*');
  console.log("Current payroll records:", data);
  
  if (data) {
    for (const record of data) {
      if (record.total_amount === 3000 || record.net_balance === 3000) {
        await supabase.from('payroll').delete().eq('id', record.id);
        console.log("Deleted stale record:", record.id);
      }
      
      // If there are duplicates of Anitha with 0 amount, keep only one.
      // Actually let's just delete ALL records where total_amount == 0 just to clean up his screen,
      // or we let him delete via the UI bin icon. I'll just delete the 3000 one.
    }
  }
}
run();
