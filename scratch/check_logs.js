
const fetch = require('node-fetch');

const SUPABASE_URL = 'https://sgyladamwnanudnropwl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneWxhZGFtd25hbnVkbnJvcHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDY5NjIsImV4cCI6MjA4NzUyMjk2Mn0.QKqv8GUv6NFu4EyTdGu-hqKBV8u13GzKJnUy-dK5Qpw';

async function checkLogs() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_logs?select=*&or=(payload->>original_recipient.ilike.*7600004090*,payload->>to.ilike.*7600004090*)&order=created_at.desc&limit=10`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });
    const logs = await res.json();
    console.log(JSON.stringify(logs, null, 2));
}

checkLogs();
