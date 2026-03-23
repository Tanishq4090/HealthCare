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
import { requireAuth } from "../middleware/auth.js";
import { validateStrict } from "../middleware/validation.js";
import { body, param, query } from "express-validator";
import rateLimit from "express-rate-limit";
import * as whatsappService from "../services/whatsappService.js";

const router = express.Router();

// ── Strict Rate Limiters ──────────────────────────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour per IP
  limit: 20, // 20 requests per hour strictly
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI quota exceeded. Please try again later." }
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // 5 OTP requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification requests. Please wait 15 minutes." }
});

const {
  META_ACCESS_TOKEN,
  META_PHONE_NUMBER_ID,
  META_WEBHOOK_VERIFY_TOKEN,
  DEV_MODE,
} = process.env;

// Broadcast function injected from server.js
let broadcastFn = null;
export function setWss(fn) { broadcastFn = fn; }
export function broadcast(event, data) { broadcastFn?.(event, data); }

// ── CRM: Get all conversations ────────────────────────────────────────────────
router.get("/conversations", requireAuth, (_req, res) => {
  res.json(getAllConversations());
});

// ── CRM: Get single conversation ──────────────────────────────────────────────
router.get("/conversations/:phone", [
  param("phone").trim().isString().notEmpty(),
  validateStrict
], requireAuth, (req, res) => {
  const conv = getConversation(decodeURIComponent(req.params.phone));
  if (!conv) return res.status(404).json({ error: "Not found" });
  res.json(conv);
});

// ── CRM: Mark read ────────────────────────────────────────────────────────────
router.post("/conversations/:phone/read", [
  param("phone").trim().isString().notEmpty(),
  validateStrict
], requireAuth, (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  markRead(phone);
  broadcast("conversation_updated", getConversation(phone));
  res.json({ success: true });
});

// ── CRM: Toggle AI ────────────────────────────────────────────────────────────
router.post("/bot/toggle/:phone", [
  param("phone").trim().isString().notEmpty(),
  body("enabled").isBoolean(),
  validateStrict
], requireAuth, (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  const { enabled } = req.body;
  setAIEnabled(phone, enabled);
  broadcast("conversation_updated", getConversation(phone));
  res.json({ success: true, aiEnabled: enabled });
});

// ── CRM: Agent sends message ──────────────────────────────────────────────────
router.post("/conversations/:phone/send", [
  param("phone").trim().isString().notEmpty(),
  body("message").trim().isString().notEmpty(),
  validateStrict
], requireAuth, async (req, res) => {
  const phone = decodeURIComponent(req.params.phone);
  const { message } = req.body;

  const msg = addMessage(phone, "agent", message);
  broadcast("new_message", { phone, message: msg });

  try {
    const isDevMode = DEV_MODE?.trim() === "true";
    await whatsappService.sendWhatsAppMessage(phone, message, isDevMode);
    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Booking confirmation message ──────────────────────────────────────────────
router.post("/send-booking-confirmation", [
  body("phone").trim().isString().notEmpty(),
  body("name").trim().isString().notEmpty().escape(), // Escape names/locations to prevent basic XSS
  body("service").trim().isString().notEmpty().escape(),
  body("date").trim().isString().notEmpty().escape(),
  body("time").trim().isString().notEmpty().escape(),
  body("location").trim().isString().notEmpty().escape(),
  validateStrict
], async (req, res) => {
  const payload = req.body;
  
  try {
    const isDevMode = DEV_MODE?.trim() === "true";
    await whatsappService.sendBookingConfirmation(payload, isDevMode);
    res.json({ success: true });
  } catch (err) {
    console.error("[Booking confirmation] Failed:", err.message);
    // Don't fail the whole booking if WhatsApp fails
    res.json({ success: false, warning: err.message });
  }
});

// ── CRM: Chat (AI reply test) ─────────────────────────────────────────────────
router.post("/chat", aiLimiter, [
  body("phone").trim().isString().notEmpty(),
  body("message").trim().isString().notEmpty(),
  validateStrict
], requireAuth, async (req, res) => {
  const { phone, message } = req.body;
  try {
    const { reply } = await processMessage(phone, message);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── OTP: Send ─────────────────────────────────────────────────────────────────
router.post("/send-otp", otpLimiter, [
  body("phone").trim().isString().matches(/^\+\d{7,15}$/).withMessage("Invalid phone format"),
  validateStrict
], async (req, res) => {
  const { phone } = req.body;
  if (hasActiveOTP(phone))
    return res.status(429).json({ error: "Code already sent. Please wait." });

  const code = generateOTP(phone);

  try {
    const isDevMode = DEV_MODE?.trim() === "true";
    await whatsappService.sendOTPMessage(phone, code, isDevMode);
    res.json({ success: true, ...(isDevMode ? { mockCode: code } : {}) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── OTP: Verify ───────────────────────────────────────────────────────────────
router.post("/verify-otp", otpLimiter, [
  body("phone").trim().isString().notEmpty(),
  body("code").trim().isString().notEmpty(),
  validateStrict
], (req, res) => {
  const { phone, code } = req.body;
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
    if (conv.aiEnabled) {
      const isDevMode = DEV_MODE?.trim() === "true";
      whatsappService.handleInboundMessage(from, text, isDevMode, broadcast);
    }
  } catch (err) {
    console.error("[Webhook] Error:", err.message);
  }
});

export default router;
