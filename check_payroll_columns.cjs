require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('payroll').select('*').limit(1);
  if (error) {
      console.error(error);
  } else if (data && data.length > 0) {
      console.log(Object.keys(data[0]));
  }
}
check();
