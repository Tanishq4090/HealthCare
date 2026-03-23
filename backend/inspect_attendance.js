import { supabase } from './services/supabase.js';

async function inspectAttendance() {
  console.log('--- Inspecting Supabase Attendance Table ---');
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .limit(1);

    if (error) {
       console.error('❌ SELECT FAILED:', error.message);
       return;
    }

    if (data && data.length > 0) {
      console.log('✅ Found record. Columns:', Object.keys(data[0]));
      console.log('Sample data:', data[0]);
    } else {
      console.log('ℹ️ Table is empty. Cannot inspect columns via select * limit 1.');
      console.log('Attempting to check metadata if possible...');
      // Try to insert a dummy row to a non-existent column to trigger a helpful error? 
      // Nah, let's just try to check common columns.
    }
  } catch (err) {
    console.error('💥 UNEXPECTED ERROR:', err);
  }
}

inspectAttendance();
