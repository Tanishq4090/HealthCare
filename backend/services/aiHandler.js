/**
 * aiHandler.js
 * Powered by Google Gemini (free via AI Studio)
 * Get your free key at: https://aistudio.google.com/app/api-keys
 */

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const SYSTEM_PROMPT = `🌟 Welcome to 99 Care. 🌟
🦋Life's journey is often filled with loneliness, pain and challenges... But now you are not alone. 99 Care is ready to help! 💙✨

You are a friendly, professional, and empathetic patient care assistant for 99 Care. 
Your primary goal is to assist clients via WhatsApp, providing information about our services, pricing, and guiding them through our booking process.

🏡 What services do we provide?
📌 Home-based personal care
📌 Loving assistance for the elderly
📌 Specially caring service for children and mothers
📌 Home nursing and injection services
📌 Tiffin service
📌 Doctor on call
📌 Physiotherapist at home
📌 Healthcard AMC
📌 Laboratory tests at home
📌 Medical equipment on rent
📌 Home delivery of medicines
📌 Home dressing and wound treatment
📌 Doctor visit at home
📌 Twins Baby care taker

💰 Service Charges
🔹 10-Hour Service:
- Full Month: ₹850 per day
- Incomplete: ₹1050 per day

🔹 Day/Night Duty (10 hrs):
- If a caregiver takes 1 day off, no replacement will be provided.
- If the leave is more than 1 day, a replacement caregiver will be arranged (on Availability).
- If you cancel the service after taking a 2-day trial, you will be charged Rs 1050 per day.

Note: Please advise clients not to discuss payment matters with the staff. 99 Care is not responsible for any such issues. Staff will be provided based on availability and allocation.

📝 Service Booking Process (Guide clients step-by-step through this):
Step 1: Fill the Client Confirmation Form (https://shorturl.at/1rmJI)
Step 2: Submit the Work Form (https://docs.google.com/forms/d/e/1FAIpQLSeHS5ZHvQT4AMLV9lTcNk524ntiFSL_73YF3Hy9WTNqIB0JgA/viewform?usp=header)
Step 3: Our team will visit the patient
Step 4: Allocation of the caregiver
Step 5: Initial deposit payment (₹15,000) to commence services. This will be adjusted against the final payment.

💌 Contact Details:
📞 WhatsApp / Call: +91 9016116564
🌐 Website: www.99care.org
📍 Visit Us: 104, Fortune Mall, Galaxy Circle, Adajan, Surat

🔗 Socials:
Facebook: https://shorturl.at/X7zgv
Instagram: https://shorturl.at/b9xWv
Review Us on Google: https://shorturl.at/tN8oT

Rules for you (the AI):
- 🎯 **GOAL**: You have exactly **10 messages** to close the deal or get the client to fill the confirmation form. Be proactive.
- If the current message count is high (7-9), push for a final decision or offer a manager callback to close the deal.
- Keep replies concise, friendly, and empathetic. This is WhatsApp, not an email.
- Use emojis naturally but professionally.
- Use simple formatting: *bold* for important info, line breaks for lists.
- If they ask to book, provide Step 1 and Step 2 links immediately.
- Never diagnose conditions — always recommend consulting a doctor.
- Respond in the same language the patient writes in.
- ✨ Let's build a confident and happy life together! 🦋`;

/** In-memory stateful session store: phone → { history: [], state: string, intent: string } */
const sessions = new Map();
const sessionTimers = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;

function resetSessionTimer(phone) {
  if (sessionTimers.has(phone)) clearTimeout(sessionTimers.get(phone));
  sessionTimers.set(phone, setTimeout(() => {
    sessions.delete(phone);
    sessionTimers.delete(phone);
  }, SESSION_TTL_MS));
}

/**
 * Convert OpenAI-style history to Gemini format.
 */
function toGeminiHistory(history) {
  return history.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
}

/**
 * Pre-router logic to classify user intent explicitly.
 */
async function analyzeIntent(message) {
  try {
    const url = `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "You are an intent classifier. Categorize the message strictly into one of the following words: BOOKING, PRICING, SUPPORT, COMPLAINT, GENERAL. Return ONLY that single word in UPPERCASE with zero punctuation." }]
        },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: { maxOutputTokens: 10, temperature: 0.1 },
      }),
    });
    const data = await response.json();
    const intentRaw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "GENERAL";
    const validIntents = ["BOOKING", "PRICING", "SUPPORT", "COMPLAINT", "GENERAL"];
    return validIntents.includes(intentRaw) ? intentRaw : "GENERAL";
  } catch (e) {
    return "GENERAL";
  }
}

/**
 * Process an inbound WhatsApp message using Gemini AI stateful routing.
 * @param {string} phone
 * @param {string} message
 * @param {number} messageCount
 */
export async function processMessage(phone, message, messageCount = 0) {
  if (!sessions.has(phone)) {
    sessions.set(phone, { history: [], state: 'idling', intent: 'GENERAL' });
  }
  
  const session = sessions.get(phone);
  resetSessionTimer(phone);

  // Intent Pipeline Overlay
  const intent = await analyzeIntent(message);
  session.intent = intent;
  
  // Transition state paths dynamically based on intent classification
  if (intent === "BOOKING" && session.state !== "booking_flow") {
    session.state = "booking_flow";
    session.history.push({ role: "assistant", content: "[System Transition]: User intends to book a service. Strongly emphasize the booking forms." });
  } else if (intent === "COMPLAINT") {
    session.state = "escalation_flow";
    return { 
      reply: "I'm very sorry you are facing issues. Let me connect you directly to our human support manager. Please wait a moment while I transfer this chat.",
      history: [...session.history]
    };
  }

  // Add user message to state history
  session.history.push({ role: "user", content: message });
  if (session.history.length > 40) session.history.splice(0, session.history.length - 40);

  try {
    const url = `${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: `${SYSTEM_PROMPT}\n\n[System Overlay - User Intent Detected: ${session.intent}] [Flow State: ${session.state}]\n[Note: This is message ${messageCount + 1} of 10 for this customer.]` }],
        },
        contents: toGeminiHistory(session.history),
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Gemini API error");
    }

    const reply =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I'm sorry, I couldn't process that. Please try again.";

    session.history.push({ role: "assistant", content: reply });
    return { reply, history: [...session.history] };

  } catch (err) {
    console.error("[Gemini] Error:", err.message);
    const fallback =
      "I'm having trouble connecting right now. Please call us at *+91 9016116564* or try again in a moment.";
    session.history.push({ role: "assistant", content: fallback });
    return { reply: fallback, history: [...session.history] };
  }
}

export function clearSession(phone) {
  sessions.delete(phone);
  if (sessionTimers.has(phone)) {
    clearTimeout(sessionTimers.get(phone));
    sessionTimers.delete(phone);
  }
}

export function getSession(phone) {
  return sessions.get(phone)?.history ?? [];
}
