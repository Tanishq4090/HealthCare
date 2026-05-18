import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_ANON_KEY || ""
);

async function checkLogs() {
  console.log("=== RECENT DEPOSIT REQUEST LOGS ===");
  const { data: logs, error: logsErr } = await supabase
    .from('whatsapp_logs')
    .select('*')
    .filter('payload->>templateName', 'eq', 'deposit_request')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (logsErr) console.error("Logs error:", logsErr);
  console.log(JSON.stringify(logs, null, 2));

  console.log("\n=== ALL RECENT FAILED LOGS ===");
  const { data: failedLogs } = await supabase
    .from('whatsapp_logs')
    .select('*')
    .filter('status', 'eq', 'failed')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log(JSON.stringify(failedLogs, null, 2));
}

checkLogs();
