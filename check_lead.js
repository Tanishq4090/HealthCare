import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_ANON_KEY || ""
);

async function purgeDummy() {
  const { data, error } = await supabase
    .from('crm_leads')
    .delete()
    .eq('id', '3e9dbaea-ea18-4d9a-8ab5-3d4672e33673');
    
  if (error) console.error(error);
  console.log("Deleted dummy lead");
}

purgeDummy();
