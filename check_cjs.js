const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_ANON_KEY || ""
);

async function checkDB() {
  const { data: leads, error: leadsErr } = await supabase.from('crm_leads').select('id, name, pipeline_stage');
  const { data: clients, error: clientsErr } = await supabase.from('clients').select('id, client_name');
  
  if (leadsErr) console.error("Leads error:", leadsErr);
  if (clientsErr) console.error("Clients error:", clientsErr);
  
  console.log("=== CRM LEADS ===");
  console.log(JSON.stringify(leads, null, 2));
  console.log(`Total Leads: ${leads?.length || 0}`);
  
  console.log("\n=== CLIENTS ===");
  console.log(JSON.stringify(clients, null, 2));
  console.log(`Total Clients: ${clients?.length || 0}`);
}

checkDB();
