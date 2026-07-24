import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'RenamedProject/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: leads, error } = await supabase.from('crm_leads').select('id, name, phone, whatsapp_number, created_at, notes, pipeline_stage').order('created_at', { ascending: true });
  if (error) { console.error(error); return; }
  
  const phoneMap = {};
  const duplicates = [];
  
  for (const lead of leads) {
      let num = lead.phone || lead.whatsapp_number;
      if (!num) continue;
      const last10 = num.replace(/\D/g, '').slice(-10);
      if (last10.length < 10) continue;
      
      if (phoneMap[last10]) {
          duplicates.push({ original: phoneMap[last10], duplicate: lead });
      } else {
          phoneMap[last10] = lead;
      }
  }
  
  console.log(`Found ${duplicates.length} duplicates.`);
  for (const d of duplicates) {
      console.log(`- Duplicate: ${d.duplicate.name} (${d.duplicate.phone} / ${d.duplicate.whatsapp_number})`);
      console.log(`  Delete Query: DELETE FROM crm_leads WHERE id = '${d.duplicate.id}';`);
      
      // We can also automate the deletion!
      const { error: delErr } = await supabase.from('crm_leads').delete().eq('id', d.duplicate.id);
      if (delErr) console.error("Failed to delete", delErr);
      else console.log("Deleted duplicate", d.duplicate.id);
  }
}
check();
