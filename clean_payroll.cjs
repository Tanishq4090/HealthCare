require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('payroll').select('*');
  console.log("Current payroll records:", data);
  
  if (data) {
    let anithaCount = 0;
    for (const record of data) {
      if (record.total_amount === 3000 || record.net_balance === 3000) {
        await supabase.from('payroll').delete().eq('id', record.id);
        console.log("Deleted stale record (3000):", record.id);
      }
      
      // Keep only one Anitha 0 amount record, delete others to clean up the duplicates
      if (record.worker === 'Anitha' && record.total_amount === 0) {
        anithaCount++;
        if (anithaCount > 1) {
            await supabase.from('payroll').delete().eq('id', record.id);
            console.log("Deleted duplicate Anitha record:", record.id);
        }
      }
    }
  }
}
run();
