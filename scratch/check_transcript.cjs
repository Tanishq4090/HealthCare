const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://sgyladamwnanudnropwl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: trans, error: transError } = await supabase
    .from('call_transcripts')
    .select('*')
    .ilike('phone_number', '%9825225206%');
    
  if (transError) console.error("trans error:", transError.message);
  else {
      console.log("transcripts for 9825225206:", JSON.stringify(trans, null, 2));
  }
}

check();
