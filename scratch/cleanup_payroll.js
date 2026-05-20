import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_ANON_KEY || ""
);

async function cleanup() {
  console.log("Deleting old duplicate payroll entry for assignment 36c57730-3da2-408e-b218-575e1ac2d510...");
  const { data, error } = await supabase
    .from('payroll')
    .delete()
    .eq('assignment_id', '36c57730-3da2-408e-b218-575e1ac2d510');
  
  if (error) {
    console.error("Cleanup error:", error);
  } else {
    console.log("Cleanup success!", data);
  }
}

cleanup();
