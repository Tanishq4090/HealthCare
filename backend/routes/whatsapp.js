/**
 * routes/whatsapp.js
 * Meta WhatsApp Cloud API (free, official)
 *
 * Endpoints:
 *  POST /api/whatsapp/send-otp    – Send OTP via Meta WhatsApp
 *  POST /api/whatsapp/verify-otp  – Verify submitted OTP code
 *  GET  /api/whatsapp/webhook     – Meta webhook verification challenge
 *  POST /api/whatsapp/webhook     – Meta inbound message handler
 */

import express from "express";
import { generateOTP, verifyOTP, hasActiveOTP } from "../services/otpService.js";
import { processMessageAsync as getAiResponse, getAllSessions, addAdminReplyToHistory } from "../services/aiHandler.js";

const router = express.Router();

/**
 * Send a WhatsApp text message via Meta Cloud API.
 * @param {string} to   - E.164 with "+", e.g. "+14155552671"
 * @param {string} body - Message text
 */
async function sendWhatsApp(to, body) {
  const cleanNumber = to.replace(/^\+/, "");

  const META_API_URL = `https://graph.facebook.com/v19.0/${process.env.META_PHONE_NUMBER_ID}/messages`;

  const res = await fetch(META_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
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

// ── POST /api/whatsapp/send-otp ───────────────────────────────────────────────
router.post("/send-otp", async (req, res) => {
  const { phone } = req.body;

  if (!phone || !/^\+\d{7,15}$/.test(phone)) {
    return res.status(400).json({ error: "Invalid phone number. Use E.164 format (+14155552671)." });
  }

  // Rate-limit commented out for local mock testing
  /*
  if (hasActiveOTP(phone)) {
    return res.status(429).json({
      error: "A code was already sent. Please wait before requesting a new one.",
    });
  }
  */

  const code = generateOTP(phone);

  // DEV MODE: log to terminal instead of sending
  if (process.env.DEV_MODE?.trim().toLowerCase() === "true") {
    console.log(`\n==========================================`);
    console.log(`🚀 [DEV MODE MOCK WHATSAPP MESSAGE TO ${phone}]:`);
    console.log(`Your HealthFirst verification code is: *${code}*`);
    console.log(`==========================================\n`);
    return res.json({ success: true, mockCode: code, message: "DEV MODE: Check terminal for code." });
  }

  try {
    await sendWhatsApp(
      phone,
      `Your HealthFirst verification code is: *${code}*\n\nExpires in 10 minutes. Do not share this code.`
    );
    console.log(`[OTP] Sent to ${phone}`);
    return res.json({ success: true, message: "OTP sent via WhatsApp." });
  } catch (err) {
    console.error("[OTP] Send error:", err.message);
    return res.status(500).json({ error: `Failed to send: ${err.message}` });
  }
});

// ── POST /api/whatsapp/verify-otp ─────────────────────────────────────────────
router.post("/verify-otp", (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: "Phone and code are required." });
  }

  const result = verifyOTP(phone, String(code));

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ success: true, message: "Phone number verified." });
});

// ── GET /api/whatsapp/webhook – Meta challenge verification ───────────────────
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN?.trim()) {
    console.log("[Webhook] Meta verification successful.");
    return res.status(200).send(challenge);
  }

  console.warn(`[Webhook] Verification failed — token mismatch.`);
  console.warn(`[Webhook] Expected: "${process.env.META_WEBHOOK_VERIFY_TOKEN?.trim()}"`);
  console.warn(`[Webhook] Received: "${token}"`);
  return res.sendStatus(403);
});

// ── POST /api/whatsapp/webhook – inbound messages ─────────────────────────────
router.post("/webhook", (req, res) => {
  res.sendStatus(200); // Respond fast — Meta requires this

  try {
    const messages = req.body?.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages?.length) return;

    const inbound = messages[0];
    if (inbound.type !== "text") return;

    const from = inbound.from;         // "14155552671" (no +)
    const text = inbound.text?.body?.trim();
    if (!from || !text) return;

    console.log(`[Webhook] From +${from}: "${text}"`);
    handleInbound(`+${from}`, text);
  } catch (err) {
    console.error("[Webhook] Error:", err.message);
  }
});

async function handleInbound(phone, message) {
  try {
    // using the new async handler to talk to Claude
    const { reply } = await getAiResponse(phone, message);
    await sendWhatsApp(phone, reply);
    console.log(`[Bot] Replied to ${phone}`);
  } catch (err) {
    console.error(`[Bot] Reply failed for ${phone}:`, err.message);
  }
}

// ── CRM Live Chat Endpoints ───────────────────────────────────────────────────
router.get("/sessions", (req, res) => {
  res.json({ sessions: getAllSessions() });
});

router.post("/admin-reply", async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: "Missing phone or message" });
  }

  try {
    // 1. Send actual message via Meta API
    await sendWhatsApp(phone, message);

    // 2. Add to Claude's memory history so it knows the admin replied
    addAdminReplyToHistory(phone, message);

    res.json({ success: true, message: "Reply sent" });
  } catch (err) {
    console.error("[Admin Reply Error]:", err);
    res.status(500).json({ error: "Failed to send admin reply" });
  }
});

export default router;
