import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config();

const supabaseUrl = 'https://sgyladamwnanudnropwl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTk0Njk2MiwiZXhwIjoyMDg3NTIyOTYyfQ.zdmAsvm5A_lFb0EV8Y0N1ydwlrZX9q8Q8uhTcOa2TqI';

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const anonSupabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTests() {
  const report = [];

  function addReport(id, desc, expected, actual, status) {
    report.push({ id, desc, expected, actual, status });
  }

  // 2.1 Bucket Exists
  let t21Actual = 'Not found';
  let t21Status = 'FAIL';
  try {
    const { data, error } = await supabase.storage.getBucket('employee-photos');
    if (data && data.name === 'employee-photos') {
      t21Actual = 'exists';
      t21Status = 'PASS';
    } else if (error) {
      t21Actual = error.message;
    }
  } catch (err) {
    t21Actual = err.message;
  }
  addReport('2.1', 'Bucket exists', 'exists', t21Actual, t21Status);

  // Setup Test User for Authenticated tests
  const testEmail = `test_auth_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let authClient = null;
  let userId = null;

  try {
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });

    if (userError) {
      console.log('Failed to create user:', userError.message);
    } else if (userData.user) {
      userId = userData.user.id;
      const { data: sessionData, error: signInError } = await anonSupabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword
      });

      if (signInError) {
        console.log('Failed to sign in:', signInError.message);
      } else if (sessionData.session) {
        authClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${sessionData.session.access_token}`
            }
          }
        });
      }
    }
  } catch (err) {
    console.log('Auth setup failed:', err.message);
  }

  // 2.2 Authenticated Upload
  let t22Actual = 'failed';
  let t22Status = 'FAIL';
  const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mP8/xwAAwcBfQOat9SAAAAAAElFTkSuQmCC', 'base64');
  
  if (authClient) {
    const { data, error } = await authClient.storage
      .from('employee-photos')
      .upload('photos/test-upload.png', testImageBuffer, { contentType: 'image/png', upsert: true });
    
    if (data && data.path) {
      t22Actual = data.path;
      t22Status = 'PASS';
    } else if (error) {
      t22Actual = error.message;
    }
  } else {
    t22Actual = 'auth setup failed';
  }
  addReport('2.2', 'Authenticated Upload', 'success', t22Actual, t22Status);

  // 2.3 Public URL Generation
  let t23Actual = 'failed';
  let t23Status = 'FAIL';
  const { data: urlData } = supabase.storage.from('employee-photos').getPublicUrl('photos/test-upload.png');
  if (urlData.publicUrl) {
    try {
      const res = await fetch(urlData.publicUrl);
      if (res.status === 200) {
        t23Actual = '200 OK';
        t23Status = 'PASS';
      } else {
        t23Actual = `HTTP ${res.status}`;
      }
    } catch (err) {
      t23Actual = 'fetch error';
    }
  }
  addReport('2.3', 'Public URL Generation', '200 OK', t23Actual, t23Status);

  // 2.4 File Size Limit
  let t24Actual = 'uploaded';
  let t24Status = 'FAIL';
  const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
  const { error: sizeError } = await (authClient || supabase).storage
    .from('employee-photos')
    .upload('photos/test-large.png', largeBuffer, { contentType: 'image/png', upsert: true });
  
  if (sizeError && (sizeError.message.includes('limit') || sizeError.message.includes('size') || sizeError.statusCode === '413')) {
    t24Actual = 'rejected';
    t24Status = 'PASS';
  } else if (sizeError) {
    t24Actual = `rejected (${sizeError.message})`;
    t24Status = 'PASS';
  }
  addReport('2.4', 'File Size Limit', 'rejected', t24Actual, t24Status);

  // 2.5 MIME Type Restriction
  let t25Actual = 'allowed';
  let t25Status = 'FAIL';
  const { error: txtError } = await (authClient || supabase).storage
    .from('employee-photos')
    .upload('photos/test.txt', Buffer.from('test'), { contentType: 'text/plain', upsert: true });
  
  const { error: exeError } = await (authClient || supabase).storage
    .from('employee-photos')
    .upload('photos/test.exe', Buffer.from('test'), { contentType: 'application/x-msdownload', upsert: true });

  const { error: okError } = await (authClient || supabase).storage
    .from('employee-photos')
    .upload('photos/test.webp', testImageBuffer, { contentType: 'image/webp', upsert: true });

  if (txtError && exeError && !okError) {
    t25Actual = 'restricted';
    t25Status = 'PASS';
  } else {
    t25Actual = `txt:${txtError?'rej':'ok'}, exe:${exeError?'rej':'ok'}, webp:${okError?'err':'ok'}`;
  }
  addReport('2.5', 'MIME Type Restriction', 'restricted', t25Actual, t25Status);

  // 2.6 Anon Upload Blocked
  let t26Actual = 'allowed';
  let t26Status = 'FAIL';
  const { error: anonError } = await anonSupabase.storage
    .from('employee-photos')
    .upload('photos/test-anon.png', testImageBuffer, { contentType: 'image/png', upsert: true });
  
  if (anonError) {
    t26Actual = 'denied';
    t26Status = 'PASS';
  }
  addReport('2.6', 'Anon Upload Blocked', 'denied', t26Actual, t26Status);

  // Cleanup
  if (userId) {
    await supabase.auth.admin.deleteUser(userId);
  }
  await supabase.storage.from('employee-photos').remove(['photos/test-upload.png', 'photos/test-large.png', 'photos/test-anon.png', 'photos/test.txt', 'photos/test.exe', 'photos/test.webp']);

  // Output Report
  console.log('\nTest ID | Description | Expected | Actual | Status');
  console.log('---|---|---|---|---');
  report.forEach(r => {
    console.log(`${r.id} | ${r.desc} | ${r.expected} | ${r.actual} | ${r.status}`);
  });
}

runTests();
