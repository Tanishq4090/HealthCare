import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres.nndvrtxtmkslwudbofzj:healthfirst202611!!@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
});

async function run() {
  await client.connect();
  console.log("Connected to PostgreSQL");
  
  try {
    await client.query(`DROP KEYWORD IF EXISTS public.workers_legacy CASCADE;`);
    await client.query(`DROP TABLE IF EXISTS "public"."workers_legacy" CASCADE;`);
    console.log("workers_legacy dropped.");
  } catch (e) {
    console.error("Drop failed:", e);
  }

  await client.end();
}

run();
