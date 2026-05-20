import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_ANON_KEY || ""
);

async function checkDB() {
  const { data: attendance, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('worker_id', 'c261d8c4-9a94-42b3-a5c1-ccf11c5a076c');
  
  if (error) console.error(error);
  console.log("=== ATTENDANCE ===");
  console.log(JSON.stringify(attendance, null, 2));
}

checkDB();
