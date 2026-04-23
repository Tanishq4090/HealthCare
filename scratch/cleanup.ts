import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://sgyladamwnanudnropwl.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'your-service-key-here';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanData() {
  console.log('Starting data cleanup...');

  // Wipe call logs & transcripts
  const { error: logsError } = await supabase.from('crm_call_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  console.log('Call logs cleared:', logsError?.message || 'Success');

  const { error: tsError } = await supabase.from('call_transcripts').delete().neq('id', 0);
  console.log('Transcripts cleared:', tsError?.message || 'Success');

  const { error: waError } = await supabase.from('whatsapp_logs').delete().neq('id', 0);
  console.log('WhatsApp logs cleared:', waError?.message || 'Success');

  const { error: wamsgError } = await supabase.from('whatsapp_messages').delete().neq('id', 0);
  console.log('WhatsApp messages cleared:', wamsgError?.message || 'Success');

  // Clear ONLY dummy leads (starts with mock-lead-)
  const { data: leads } = await supabase.from('crm_leads').select('id, name');
  if (leads) {
    const dummyLeads = leads.filter((l: any) => l.id.startsWith('mock-lead-') || l.name === 'Dummy' || l.name === 'Test');
    for (const dl of dummyLeads) {
        await supabase.from('crm_leads').delete().eq('id', dl.id);
    }
    console.log(`Cleared ${dummyLeads.length} mock leads.`);
  }

  // Drop table is best done via migration. 
  console.log('Cleanup complete.');
}

cleanData();
