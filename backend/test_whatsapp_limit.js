import { getOrCreate, addMessage } from './services/conversationStore.js';

const testPhone = "+919999999999";

console.log("--- Testing WhatsApp AI Limit ---");

// 1. Simulate 10 AI messages
console.log("Simulating 10 AI responses...");
for (let i = 0; i < 10; i++) {
    addMessage(testPhone, "assistant", `AI Reply ${i + 1}`);
}

const conv = getOrCreate(testPhone);
console.log(`Current AI Response Count: ${conv.aiResponseCount}`);

if (conv.aiResponseCount === 10) {
    console.log("✅ Count is 10.");
} else {
    console.log("❌ Count mismatch!");
    process.exit(1);
}

console.log("\nNext inbound message should trigger handoff (logic is in routes/whatsapp.js, but we verified the store correctly tracks it).");
