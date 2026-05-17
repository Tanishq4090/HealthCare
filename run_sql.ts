import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
const client = new Client(Deno.env.get("VITE_SUPABASE_URL") ? Deno.env.get("VITE_SUPABASE_URL").replace("https://", "postgres://postgres:").replace(".supabase.co", ".supabase.co:5432/postgres") : "");
await client.connect();
const result = await client.queryObject(`SELECT created_at, payload FROM whatsapp_logs WHERE payload->>'type' = 'flow_submission' ORDER BY created_at DESC LIMIT 5`);
console.log(result.rows);
await client.end();
