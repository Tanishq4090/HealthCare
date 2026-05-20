require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fix() {
  const { data, error } = await supabase.from('payroll')
      .update({ daily_rate: 1000/30 })
      .eq('id', 'f0686e74-85de-49f5-bbe9-c55aa0611b1a');
  console.log("Updated:", error ? error : "Success");
}
fix();
