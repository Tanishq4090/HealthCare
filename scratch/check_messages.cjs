const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sgyladamwnanudnropwl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: msgs, error: msgsError } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .ilike('phone', '%9825225206%')
    .order('created_at', { ascending: false });
    
  if (msgsError) console.error("msgs error:", msgsError.message);
  else {
      console.log("messages for 9825225206:", JSON.stringify(msgs, null, 2));
  }
}

check();
