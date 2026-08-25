import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://sgyladamwnanudnropwl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw');

async function test() {
    // Get Tanishq's client UUID
    const { data: clients } = await supabase.from('crm_leads').select('id, name').ilike('name', '%Tanishq%');
    console.log("Clients:", clients);
    
    if (clients && clients.length > 0) {
        for (const c of clients) {
            const { data: assignments } = await supabase.from('worker_assignments').select('id, assignment_status, start_date').eq('client_id', c.id);
            console.log(`Assignments for ${c.name} (${c.id}):`, assignments);
        }
    }
}
test();
