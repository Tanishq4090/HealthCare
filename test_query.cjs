require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: payroll, error } = await supabase.from('payroll').select('*');
  console.log("Payroll items:", payroll.length);
  
  const item = payroll[0]; // Let's take Anitha
  console.log("Testing worker:", item?.worker, item?.worker_id);
  
  let targetEmployeeId = item?.worker_id;
  if (!targetEmployeeId) {
     const {data: emps} = await supabase.from('employees').select('*').eq('full_name', item?.worker);
     if (emps && emps.length > 0) targetEmployeeId = emps[0].id;
  }
  
  console.log("Target Employee ID:", targetEmployeeId);
  
  if (targetEmployeeId) {
    const { data, error: err2 } = await supabase
      .from('worker_assignments')
      .select('*, employees(*), clients(*)')
      .eq('employee_id', targetEmployeeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    console.log("Assignment data:", !!data, "Error:", err2);
  }
}
run();
