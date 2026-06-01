const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sgyladamwnanudnropwl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: logs, error: logsError } = await supabase
    .from('whatsapp_logs')
    .select('*')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (logsError) console.error("logs error:", logsError.message);
  else {
      console.log("recent failed logs:", JSON.stringify(logs, null, 2));
  }
}

check();
