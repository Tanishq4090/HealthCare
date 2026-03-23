import { supabase } from './services/supabase.js';

async function testAttendance() {
  console.log('--- Testing Supabase Attendance Persistence ---');
  
  const testData = {
    worker_id: 'test-worker-id',
    duty_date: '2026-03-20',
    status: 'present',
    notes: 'Verification Test',
    hours_worked: 8,
    is_absent: false,
    is_leave: false,
    updated_at: new Date().toISOString()
  };

  try {
    console.log('1. Attempting UPSERT to "attendance" table...');
    const { data: upsertData, error: upsertError } = await supabase
      .from('attendance')
      .upsert(testData, { onConflict: 'worker_id,duty_date' })
      .select()
      .single();

    if (upsertError) {
      console.error('❌ UPSERT FAILED:', upsertError.message);
      return;
    }
    console.log('✅ UPSERT SUCCESSful:', upsertData);

    console.log('2. Attempting SELECT from "attendance" table...');
    const { data: selectData, error: selectError } = await supabase
      .from('attendance')
      .select('*')
      .eq('worker_id', 'test-worker-id')
      .eq('duty_date', '2026-03-20')
      .single();

    if (selectError) {
      console.error('❌ SELECT FAILED:', selectError.message);
      return;
    }
    console.log('✅ SELECT SUCCESSful:', selectData);

    console.log('3. Cleaning up test data...');
    await supabase.from('attendance').delete().eq('worker_id', 'test-worker-id');
    console.log('✅ CLEANUP COMPLETE');
    
    console.log('\n--- 100% VERIFIED: PERSISTENCE IS WORKING ---');
  } catch (err) {
    console.error('💥 UNEXPECTED ERROR:', err);
  }
}

testAttendance();
