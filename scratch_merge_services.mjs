import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://sgyladamwnanudnropwl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw');

async function test() {
    // 1. Move all SWAs from a456 to 7dde
    const { error: e1 } = await supabase.from('service_worker_assignments').update({ service_id: '7dde2069-79c3-44ed-94c8-3f7386d0e0af' }).eq('service_id', 'a4564938-eb46-4d95-b9b6-543271dc67ed');
    console.log("Moved SWAs:", e1);

    // 2. Move any payrolls pointing to a456 to 7dde
    const { error: e2 } = await supabase.from('payroll').update({ service_id: '7dde2069-79c3-44ed-94c8-3f7386d0e0af' }).eq('service_id', 'a4564938-eb46-4d95-b9b6-543271dc67ed');
    console.log("Moved Payrolls:", e2);

    // 3. Delete the duplicate service a456
    const { error: e3 } = await supabase.from('services').delete().eq('id', 'a4564938-eb46-4d95-b9b6-543271dc67ed');
    console.log("Deleted duplicate service:", e3);
}
test();
