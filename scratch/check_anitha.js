import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_ANON_KEY || ""
);

async function checkDB() {
  console.log("Fetching assignments...");
  const { data: assignments, error: assignErr } = await supabase.from('worker_assignments').select('*');
  if (assignErr) console.error("Assignments error:", assignErr);
  console.log("=== ASSIGNMENTS ===");
  console.log(JSON.stringify(assignments, null, 2));
}

checkDB();
