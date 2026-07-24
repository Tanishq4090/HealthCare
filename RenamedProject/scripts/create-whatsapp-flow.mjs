#!/usr/bin/env node
/**
 * 99 Care — WhatsApp Flows Setup Script
 * Run: node scripts/create-whatsapp-flow.mjs
 *
 * Prerequisites: Add META_SYSTEM_TOKEN and META_PHONE_NUMBER_ID to your .env file
 */

import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
/** v6.1 INTAKE_FORM with init-value prefill — upload this JSON to your existing Flow in Meta */
const FLOW_JSON = JSON.parse(readFileSync(join(__dirname, 'intake_form_flow.json'), 'utf8'));

const META_SYSTEM_TOKEN = process.env.META_SYSTEM_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || process.env.META_PHONE_ID;
const META_BUSINESS_ACCOUNT_ID = process.env.META_WABA_ID; // WhatsApp Business Account ID

if (!META_SYSTEM_TOKEN) {
  console.error('❌ META_SYSTEM_TOKEN not found in .env');
  process.exit(1);
}
if (!META_PHONE_NUMBER_ID) {
  console.error('❌ META_PHONE_NUMBER_ID (or META_PHONE_ID) not found in .env');
  process.exit(1);
}

// First, discover the WABA ID from the phone number
async function getWabaId() {
  if (META_BUSINESS_ACCOUNT_ID) return META_BUSINESS_ACCOUNT_ID;

  const res = await fetch(
    `https://graph.facebook.com/v20.0/${META_PHONE_NUMBER_ID}?fields=whatsapp_business_account&access_token=${META_SYSTEM_TOKEN}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Failed to get WABA ID: ${JSON.stringify(data)}`);
  const wabaId = data.whatsapp_business_account?.id;
  if (!wabaId) throw new Error('Could not determine WABA ID from phone number. Add META_WABA_ID to .env manually.');
  console.log(`✅ Discovered WABA ID: ${wabaId}`);
  return wabaId;
}

async function createFlow(wabaId) {
  console.log('\n📋 Step 1: Creating WhatsApp Flow...');
  const res = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/flows`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${META_SYSTEM_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: '99_Care_Lead_Intake_' + Date.now(),
      categories: ['LEAD_GENERATION']
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Flow creation failed: ${JSON.stringify(data)}`);
  console.log(`✅ Flow created! ID: ${data.id}`);
  return data.id;
}

async function uploadFlowJson(flowId) {
  console.log('\n📤 Step 2: Uploading Flow JSON schema...');
  const formData = new FormData();
  const jsonBlob = new Blob([JSON.stringify(FLOW_JSON)], { type: 'application/json' });
  formData.append('file', jsonBlob, 'flow.json');
  formData.append('name', 'flow.json');
  formData.append('asset_type', 'FLOW_JSON');

  const res = await fetch(`https://graph.facebook.com/v20.0/${flowId}/assets`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${META_SYSTEM_TOKEN}` },
    body: formData
  });
  const data = await res.json();
  if (!res.ok || data.validation_errors?.length > 0) {
    throw new Error(`JSON upload failed: ${JSON.stringify(data)}`);
  }
  console.log(`✅ Flow JSON uploaded successfully!`);
  return data;
}

async function publishFlow(flowId) {
  console.log('\n🚀 Step 3: Publishing Flow...');
  const res = await fetch(`https://graph.facebook.com/v20.0/${flowId}/publish`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${META_SYSTEM_TOKEN}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Flow publish failed: ${JSON.stringify(data)}`);
  console.log(`✅ Flow published! Status: ${data.success}`);
}

async function main() {
  try {
    console.log('🚀 99 Care — WhatsApp Flows Setup\n');
    const wabaId = await getWabaId();
    const flowId = await createFlow(wabaId);
    await uploadFlowJson(flowId);
    await publishFlow(flowId);

    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCCESS! Your WhatsApp Flow is live!');
    console.log('='.repeat(60));
    console.log(`\n📋 FLOW ID: ${flowId}`);
    console.log('\n👉 Next step — run this command to save it as a Supabase secret:');
    console.log(`   npx supabase secrets set WHATSAPP_FLOW_ID=${flowId} --project-ref sgyladamwnanudnropwl`);
    console.log('\nThen your bot will automatically use the native form for all new leads! 🎉\n');
  } catch (err) {
    console.error('\n❌ Setup failed:', err.message);
    process.exit(1);
  }
}

main();
