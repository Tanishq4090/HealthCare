import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_ANON_KEY || ""
);

async function check() {
  const { data: assignments, error: assErr } = await supabase
    .from('worker_assignments')
    .select(`
      id,
      employee_id,
      start_date,
      end_date,
      hours_per_day,
      employees (*),
      clients (*)
    `);
  if (assErr) console.error(assErr);
  console.log(JSON.stringify(assignments, null, 2));
}

check();
