/**
 * routes/whatsapp.js
 * Meta WhatsApp Cloud API + real-time CRM via WebSocket
 */

import express from "express";
import { generateOTP, verifyOTP, hasActiveOTP } from "../services/otpService.js";
import { processMessage } from "../services/aiHandler.js";
import {
  getOrCreate, addMessage, markRead,
  getAllConversations, getConversation, setAIEnabled
} from "../services/conversationStore.js";

const router = express.Router();

const {
  META_ACCESS_TOKEN,
  META_PHONE_NUMBER_ID,
  META_WEBHOOK_VERIFY_TOKEN,
  DEV_MODE,
} = process.env;

const META_API_URL = `https://graph.facebook.com/v19.0/${META_PHONE_NUMBER_ID}/messages`;

// Broadcast function injected from server.js
let broadcastFn = null;
export function setWss(fn) { broadcastFn = fn; }
function broadcast(event, data) { broadcastFn?.(event, data); }

// ── Send WhatsApp via Meta API ────────────────────────────────────────────────
async function sendWhatsApp(to, body) {
  const cleanNumber = to.replace(/^\+/, "");
  const res = await fetch(META_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${META_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: cleanNumber,
      type: "text",
      text: { body },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Meta API error");
  return data;
}

// ── CRM: Get all conversations ────────────────────────────────────────────────
router.get("/conversations", (_req, res) => {
  res.json(getAllConversations());
});

// ── CRM: Get single conversation ──────────────────────────────────────────────
router.get("/conversations/:phone", (req, res) => {
  const conv = getConversation(decodeURIComponent(req.params.phone));
  if (!conv) return res.status(404).json({ error: "Not found" });
  res.json(conv);
});

// ── CRM: Mark read ────────────────────────────────────────────────────────────
router.post("/conversations/:phone/read", (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  markRead(phone);
  broadcast("conversation_updated", getConversation(phone));
  res.json({ success: true });
});

// ── CRM: Toggle AI ────────────────────────────────────────────────────────────
router.post("/conversations/:phone/ai", (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  const { enabled } = req.body;
  setAIEnabled(phone, !!enabled);
  broadcast("conversation_updated", getConversation(phone));
  res.json({ success: true });
});

// ── CRM: Agent sends message ──────────────────────────────────────────────────
router.post("/conversations/:phone/send", async (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  const msg = addMessage(phone, "agent", message);
  broadcast("new_message", { phone, message: msg });

  if (DEV_MODE?.trim() === "true") {
    console.log(`[DEV] Agent → ${phone}: ${message}`);
    return res.json({ success: true, message: msg });
  }

  try {
    await sendWhatsApp(phone, message);
    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CRM: Chat (AI reply test) ─────────────────────────────────────────────────
router.post("/chat", async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: "phone and message required" });
  try {
    const { reply } = await processMessage(phone, message);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── OTP: Send ─────────────────────────────────────────────────────────────────
router.post("/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\+\d{7,15}$/.test(phone))
    return res.status(400).json({ error: "Invalid phone number." });
  if (hasActiveOTP(phone))
    return res.status(429).json({ error: "Code already sent. Please wait." });

  const code = generateOTP(phone);

  if (DEV_MODE?.trim() === "true") {
    console.log(`\n[DEV MODE] OTP for ${phone} → ${code}\n`);
    return res.json({ success: true, mockCode: code });
  }

  try {
    await sendWhatsApp(phone, `Your HealthFirst verification code: *${code}*\n\nExpires in 10 minutes.`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── OTP: Verify ───────────────────────────────────────────────────────────────
router.post("/verify-otp", (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: "Phone and code required." });
  const result = verifyOTP(phone, String(code));
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json({ success: true });
});

// ── Meta webhook: verify ──────────────────────────────────────────────────────
router.get("/webhook", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === META_WEBHOOK_VERIFY_TOKEN) {
    console.log("[Webhook] ✅ Meta verified");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ── Meta webhook: inbound messages ───────────────────────────────────────────
router.post("/webhook", (req, res) => {
  res.sendStatus(200);
  try {
    const messages = req.body?.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages?.length) return;
    const inbound = messages[0];
    if (inbound.type !== "text") return;

    const from = `+${inbound.from}`;
    const text = inbound.text?.body?.trim();
    if (!from || !text) return;

    // Store + broadcast to CRM instantly
    const msg = addMessage(from, "user", text);
    broadcast("new_message", { phone: from, message: msg });
    broadcast("conversation_updated", getConversation(from));
    console.log(`[Webhook] From ${from}: "${text}"`);

    const conv = getOrCreate(from);
    if (conv.aiEnabled) handleInbound(from, text);
  } catch (err) {
    console.error("[Webhook] Error:", err.message);
  }
});

async function handleInbound(phone, message) {
  try {
    // Broadcast "AI typing" state
    broadcast("ai_typing", { phone, typing: true });

    const { reply } = await processMessage(phone, message);
    const msg = addMessage(phone, "assistant", reply);

    broadcast("ai_typing", { phone, typing: false });
    broadcast("new_message", { phone, message: msg });
    broadcast("conversation_updated", getConversation(phone));

    if (DEV_MODE?.trim() !== "true") {
      await sendWhatsApp(phone, reply);
    }
    console.log(`[Bot] Replied to ${phone}`);
  } catch (err) {
    broadcast("ai_typing", { phone, typing: false });
    console.error(`[Bot] Failed for ${phone}:`, err.message);
  }
}

export default router;
