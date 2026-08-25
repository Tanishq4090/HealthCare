import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://sgyladamwnanudnropwl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw');

async function test() {
    const { data: newLead, error } = await supabase.from('crm_leads').insert([{
        name: 'Test Lead',
        phone: '+919999999999',
        whatsapp_number: '+919999999999',
        source: 'AI Phone Call',
        pipeline_stage: 'New Inquiry',
        service_interest: null,
        notes: 'Test',
        status: 'new',
        last_called_at: new Date().toISOString()
    }]).select('id').single();
    console.log("Result:", newLead, "Error:", error);
}
test();
