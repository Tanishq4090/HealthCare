/**
 * aiHandler.js
 * Processes incoming WhatsApp messages and returns a bot reply.
 *
 * Currently uses the same keyword-matching logic as your Chatbot.tsx,
 * so behavior is consistent across web chat and WhatsApp.
 *
 * To swap in a real LLM, replace the `getBotReply` function body
 * with an OpenAI / Anthropic API call and keep the same signature.
 */

import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

/** @typedef {{ role: "user"|"model", parts: [{ text: string }] }} Message */

/**
 * In-memory session store: maps phone → conversation history.
 * In production, persist this in a database (Supabase, Redis, etc.)
 * @type {Map<string, Message[]>}
 */
const sessions = new Map();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30-minute idle sessions
const sessionTimers = new Map();

function resetSessionTimer(phone) {
  if (sessionTimers.has(phone)) clearTimeout(sessionTimers.get(phone));
  sessionTimers.set(
    phone,
    setTimeout(() => {
      sessions.delete(phone);
      sessionTimers.delete(phone);
    }, SESSION_TTL_MS)
  );
}

const SYSTEM_PROMPT = `You are a helpful, professional medical receptionist for HealthFirst Clinic. 
You are chatting with a patient over WhatsApp. 
Be concise, polite, and use emojis occasionally to remain friendly.
Do not use markdown formatting that WhatsApp doesn't support (only use *bold*, _italics_, ~strikethrough~).
You can assist them with:
- Booking appointments
- Asking about services
- Getting clinic location and hours
- Directing emergencies to 911

If they want to book an appointment, ask for their preferred Date and Time.
If they want to speak to a human, let them know an agent will call them shortly.
`;

/**
 * Return the bot reply for an incoming message using Gemini AI.
 * @param {string} message
 * @param {Message[]} history - prior conversation messages
 * @returns {Promise<string>}
 */
async function getBotReplyAsync(message, history) {
  if (!process.env.GEMINI_API_KEY) {
    return "The clinic AI is currently offline (Missing GEMINI_API_KEY in backend). Please contact us directly at +1 (800) 555-HLTH.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: history,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
      }
    });

    return response.text.trim();
  } catch (error) {
    console.error("[Gemini Setup Error]", error);
    return "I'm sorry, our system is currently experiencing issues. Please try again later or call +1 (800) 555-HLTH.";
  }
}

/**
 * Main entry point: process an inbound WhatsApp message and return the reply asynchronously.
 * @param {string} phone - E.164 phone number of the sender
 * @param {string} message - The message text they sent
 * @returns {Promise<{ reply: string, history: Message[] }>}
 */
export async function processMessageAsync(phone, message) {
  // Get or create session
  if (!sessions.has(phone)) {
    sessions.set(phone, []);
  }
  const history = sessions.get(phone);
  resetSessionTimer(phone);

  // Add user message to history
  history.push({ role: "user", parts: [{ text: message }] });

  // Get bot reply from Gemini
  const reply = await getBotReplyAsync(message, history);

  // Add assistant reply to history
  history.push({ role: "model", parts: [{ text: reply }] });

  // Cap history at 40 messages to avoid context bloat
  if (history.length > 40) history.splice(0, history.length - 40);

  return { reply, history: [...history] };
}

/**
 * Admins can reply directly from the CRM UI.
 */
export function addAdminReplyToHistory(phone, message) {
  if (!sessions.has(phone)) sessions.set(phone, []);
  const history = sessions.get(phone);
  resetSessionTimer(phone);
  // Mark as model but add a special flag so the UI knows an admin sent it
  history.push({ role: "model", parts: [{ text: message }], isAdmin: true });
}

export function getAllSessions() {
  return Object.fromEntries(sessions);
}

/**
 * Clear a session (e.g. after handoff to human agent).
 * @param {string} phone
 */
export function clearSession(phone) {
  sessions.delete(phone);
  if (sessionTimers.has(phone)) {
    clearTimeout(sessionTimers.get(phone));
    sessionTimers.delete(phone);
  }
}

/**
 * Get the current session history for a phone number.
 * @param {string} phone
 * @returns {Message[]}
 */
export function getSession(phone) {
  return sessions.get(phone) ?? [];
}
