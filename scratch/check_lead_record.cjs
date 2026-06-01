const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sgyladamwnanudnropwl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: lead, error: leadError } = await supabase
    .from('crm_leads')
    .select('*')
    .eq('id', 'f19e3777-82de-4fd2-bb31-40a601d95efe');
    
  if (leadError) console.error("lead error:", leadError.message);
  else {
      console.log("lead:", JSON.stringify(lead, null, 2));
  }
}

check();
