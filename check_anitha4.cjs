require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: employees } = await supabase.from('employees').select('*').ilike('name', '%Anitha%');
  console.log("Employees:", JSON.stringify(employees, null, 2));
}
check();
