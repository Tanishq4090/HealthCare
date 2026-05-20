require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: worker } = await supabase.from('workers').select('*').eq('id', 'c261d8c4-9a94-42b3-a5c1-ccf11c5a076c');
  console.log("Worker by ID:", JSON.stringify(worker, null, 2));
  
  const { data: assignment } = await supabase.from('worker_assignments').select('*').eq('id', 'e7a0b98e-e72b-4145-9c32-55d3e45da426');
  console.log("Assignment:", JSON.stringify(assignment, null, 2));
}
check();
