import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://sgyladamwnanudnropwl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw');

async function test() {
    const { data: leads, error } = await supabase.from('crm_leads').select('id, name, phone, whatsapp_number, created_at').is('deleted_at', null).order('created_at', { ascending: true });
    
    const phoneMap = new Map();
    const dupes = [];
    
    for (const lead of leads) {
        // Normalizing phone to just digits for comparison
        const phone = (lead.whatsapp_number || lead.phone || '').replace(/\D/g, '').slice(-10);
        if (!phone || phone.length < 10) continue;
        
        if (phoneMap.has(phone)) {
            dupes.push({ keep: phoneMap.get(phone), duplicate: lead });
        } else {
            phoneMap.set(phone, lead);
        }
    }
    
    console.log(`Found ${dupes.length} duplicates.`);
    if (dupes.length > 0) {
        console.log("Example:", JSON.stringify(dupes[0], null, 2));
    }
}
test();
