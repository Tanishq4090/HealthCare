require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
  const { data: employees } = await supabase.from('employees').select('full_name, status, assigned_client').not('assigned_client', 'is', null);
  console.log("Employees with assigned_client:", JSON.stringify(employees, null, 2));

  const { data: clients } = await supabase.from('clients').select('id, client_name').ilike('client_name', '%Tanishq%');
  console.log("Clients matching Tanishq:", JSON.stringify(clients, null, 2));
  
  const { data: assignments } = await supabase.from('worker_assignments').select('*').ilike('client_id::text', '%');
  console.log("All assignments:", JSON.stringify(assignments?.slice(0,5), null, 2));
}
main();
