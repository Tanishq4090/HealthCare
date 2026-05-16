import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
const client = new Client(Deno.env.get("VITE_SUPABASE_URL") ? Deno.env.get("VITE_SUPABASE_URL").replace("https://", "postgres://postgres:").replace(".supabase.co", ".supabase.co:5432/postgres") : "");
