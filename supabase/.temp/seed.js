import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://sgyladamwnanudnropwl.supabase.co';
const supabaseAnonKey = 'sb_publishable_FI9zglMULLEIYAy-GqXYEA_sH_ciLHv';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
    const leads = [
        {
            name: 'Sarah Connor',
            source: 'Web Chat',
            status: 'AI Handled',
            pipeline_stage: 'New Lead',
            estimated_value_monthly: 5000,
        },
        {
            name: 'John Doe',
            source: 'Email',
            status: 'System',
            pipeline_stage: 'In Discussion',
            estimated_value_monthly: 12000,
        },
        {
            name: 'Jane Smith',
            source: 'Contact Form',
            status: 'Pending',
            pipeline_stage: 'Quotation Sent',
            estimated_value_monthly: 8000,
        }
    ];

    const { data, error } = await supabase.from('crm_leads').insert(leads).select();
    if (error) {
        console.error('Error inserting leads:', error);
    } else {
        console.log('Successfully inserted leads:', data);
    }
}

seed();
