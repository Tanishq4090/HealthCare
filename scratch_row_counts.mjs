import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://sgyladamwnanudnropwl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw');

async function countTable(table) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    return { table, count: error ? error.message : count };
}

async function test() {
    const tables = ['crm_leads', 'employees', 'services', 'service_worker_assignments', 'worker_assignments', 'call_transcripts', 'payroll', 'crm_quotations'];
    for (const table of tables) {
        const res = await countTable(table);
        console.log(`${res.table}: ${res.count} rows`);
    }
}
test();
