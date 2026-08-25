import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fix() {
    const { data, error } = await supabase
        .from('crm_leads')
        .update({ pipeline_stage: 'Active Client' })
        .eq('id', 'a78fee96-053a-4b9a-864e-093466451957')
        .eq('pipeline_stage', 'Deposit Pending');
    
    console.log('Error:', error);
    console.log('Done! Lead should now be Active Client.');
}
fix();
