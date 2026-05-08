require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase
    .from('call_transcripts')
    .update({ automation_error: null })
    .eq('automation_error', 'GREETING_SENT')
    .select();
    
  console.log('Reset automation_error:', data?.length, 'rows');
  if (error) console.error('Error:', error);
}

run();
