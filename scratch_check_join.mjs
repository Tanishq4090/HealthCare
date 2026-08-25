import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://sgyladamwnanudnropwl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw');

async function test() {
    const { data: d1, error: e1 } = await supabase.from('worker_assignments').select('client_id, deposit_paid, deposit_amount').gt('deposit_paid', 0);
    console.log("Paid assignments:", d1);
}
test();
