import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.VITE_SUPABASE_ANON_KEY || ""
);

async function checkLogs() {
  console.log("=== RECENT WHATSAPP LOGS ===");
  const { data: logs, error: logsErr } = await supabase
    .from('whatsapp_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (logsErr) console.error("Logs error:", logsErr);
  console.log(JSON.stringify(logs, null, 2));

  console.log("\n=== RECENT WHATSAPP MESSAGES ===");
  const { data: msgs, error: msgsErr } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (msgsErr) console.error("Messages error:", msgsErr);
  console.log(JSON.stringify(msgs, null, 2));
}

checkLogs();
