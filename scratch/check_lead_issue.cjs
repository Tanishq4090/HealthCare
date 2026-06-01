const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sgyladamwnanudnropwl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const number = '+919825225206';
  const number2 = '919825225206';
  const number3 = '9825225206';
  
  console.log("Checking whatsapp_logs...");
  const { data: logs, error: logsError } = await supabase
    .from('whatsapp_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
    
  if (logsError) console.error("logs error:", logsError.message);
  else {
      const filtered = logs.filter(c => JSON.stringify(c).includes('9825225206'));
      console.log("filtered logs:", JSON.stringify(filtered, null, 2));
  }
}

check();
