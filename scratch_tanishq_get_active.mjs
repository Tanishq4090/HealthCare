import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://sgyladamwnanudnropwl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw');

async function test() {
    const { data: svcs, error } = await supabase
        .from('services')
        .select('*, clients(*), service_worker_assignments(*, employees(full_name, id, status, job_title, photo_url))')
        .eq('status', 'active')
        .eq('client_id', '1bb4f452-09de-4d2f-9412-59cb6ce951b2')
        .order('created_at', { ascending: false });
    
    console.log("Services for Tanishq:");
    svcs.forEach(s => {
        console.log(`- Service ${s.id} created at ${s.created_at}`);
        s.service_worker_assignments.forEach(swa => {
            console.log(`  - SWA ${swa.id}: worker=${swa.employees?.full_name}, start=${swa.start_date}, end=${swa.end_date}, status=${swa.employees?.status}`);
        });
    });
}
test();
