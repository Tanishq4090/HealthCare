require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: assignments, error } = await supabase.from('worker_assignments').select('*');
  console.log("Assignments error:", error);
  console.log("Assignments:", JSON.stringify(assignments, null, 2));
  
  const { data: employees } = await supabase.from('employees').select('id, full_name, status, assigned_client');
  console.log("All employees:", JSON.stringify(employees, null, 2));
}
main();
