import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://sgyladamwnanudnropwl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw');

async function test() {
    const { data: leads, error } = await supabase.from('crm_leads').select('id, name, phone, whatsapp_number, created_at, source').is('deleted_at', null).order('created_at', { ascending: true });
    
    if (error) {
        console.error("Fetch error:", error);
        return;
    }

    const phoneMap = new Map();
    const dupes = [];
    
    for (const lead of leads) {
        const phone = (lead.whatsapp_number || lead.phone || '').replace(/\D/g, '').slice(-10);
        if (!phone || phone.length < 10) continue;
        
        if (phoneMap.has(phone)) {
            const existing = phoneMap.get(phone);
            // Prefer the lead that has a real name over "Voice Lead"
            if (existing.name === 'Voice Lead' && lead.name !== 'Voice Lead') {
                dupes.push({ keep: lead, duplicate: existing });
                phoneMap.set(phone, lead); // Update map so future dupes compare to this one
            } else {
                dupes.push({ keep: existing, duplicate: lead });
            }
        } else {
            phoneMap.set(phone, lead);
        }
    }
    
    console.log(`Found ${dupes.length} duplicates to merge.`);

    for (const { keep, duplicate } of dupes) {
        console.log(`Merging ${duplicate.id} (${duplicate.name}) into ${keep.id} (${keep.name})`);
        
        // Update services
        await supabase.from('services').update({ lead_id: keep.id, client_id: keep.id }).eq('lead_id', duplicate.id);
        
        // Update client_consents
        await supabase.from('client_consents').update({ lead_id: keep.id, client_id: keep.id }).eq('lead_id', duplicate.id);
        
        // Update crm_quotations
        await supabase.from('crm_quotations').update({ lead_id: keep.id }).eq('lead_id', duplicate.id);
        
        // Update call transcripts
        await supabase.from('call_transcripts').update({ lead_id: keep.id }).eq('lead_id', duplicate.id);

        // Update worker_assignments (if legacy)
        await supabase.from('worker_assignments').update({ client_id: keep.id }).eq('client_id', duplicate.id);
        
        // Update duplicate_of pointers that might point to the duplicate
        await supabase.from('crm_leads').update({ duplicate_of_lead_id: keep.id }).eq('duplicate_of_lead_id', duplicate.id);

        // Soft delete the duplicate
        await supabase.from('crm_leads').update({ deleted_at: new Date().toISOString() }).eq('id', duplicate.id);

        console.log(`Successfully merged ${duplicate.name} -> ${keep.name}`);
    }
}
test();
