#!/usr/bin/env node
/**
 * Upload scripts/intake_form_flow.json to an EXISTING WhatsApp Flow (no new flow ID).
 *
 * Usage:
 *   node scripts/upload-intake-flow-json.mjs
 *   node scripts/upload-intake-flow-json.mjs <FLOW_ID>
 *
 * Requires in .env: META_SYSTEM_TOKEN, and optionally WHATSAPP_FLOW_ID
 */
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const META_SYSTEM_TOKEN = process.env.META_SYSTEM_TOKEN;
const flowId = process.argv[2] || process.env.WHATSAPP_FLOW_ID;

if (!META_SYSTEM_TOKEN) {
  console.error('❌ META_SYSTEM_TOKEN missing in .env');
  process.exit(1);
}
if (!flowId) {
  console.error('❌ Pass FLOW_ID as argument or set WHATSAPP_FLOW_ID in .env');
  process.exit(1);
}

const flowJson = JSON.parse(readFileSync(join(__dirname, 'intake_form_flow.json'), 'utf8'));

async function uploadJson() {
  console.log(`📤 Uploading intake_form_flow.json to flow ${flowId}...`);
  const formData = new FormData();
  const blob = new Blob([JSON.stringify(flowJson)], { type: 'application/json' });
  formData.append('file', blob, 'flow.json');
  formData.append('name', 'flow.json');
  formData.append('asset_type', 'FLOW_JSON');

  const res = await fetch(`https://graph.facebook.com/v20.0/${flowId}/assets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${META_SYSTEM_TOKEN}` },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || data.validation_errors?.length) {
    console.error('❌ Upload failed:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
  console.log('✅ Flow JSON uploaded.');
}

async function publish() {
  console.log('🚀 Publishing flow...');
  const res = await fetch(`https://graph.facebook.com/v20.0/${flowId}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${META_SYSTEM_TOKEN}` },
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('❌ Publish failed:', JSON.stringify(data, null, 2));
    process.exit(1);
  }
  console.log('✅ Flow published. Prefill (init-value) is now live.');
}

await uploadJson();
await publish();
