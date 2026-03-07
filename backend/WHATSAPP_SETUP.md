# WhatsApp Integration – Setup Guide

## What Was Built

| File | Purpose |
|------|---------|
| `src/components/whatsapp/WhatsAppOTPVerification.tsx` | React UI – phone entry → OTP boxes → verified screen |
| `backend/server.js` | Express server entry point |
| `backend/routes/whatsapp.js` | `/send-otp`, `/verify-otp`, `/webhook` routes |
| `backend/services/otpService.js` | OTP generation, storage & verification |
| `backend/services/aiHandler.js` | Keyword-matching chatbot (mirrors Chatbot.tsx logic) |
| `backend/.env.example` | All environment variables needed |

---

## Step 1 — Twilio Setup

1. Sign up at [twilio.com](https://twilio.com)
2. Go to **Messaging → Try it out → Send a WhatsApp message**
3. Note your **Account SID** and **Auth Token** from the Console dashboard
4. The sandbox number is `+1 415 523 8886` — users must send a join code first (sandbox only)
5. For production, apply for a WhatsApp Business number in the Twilio console

---

## Step 2 — Backend Environment

```bash
cd backend
cp .env.example .env
# Fill in your Twilio credentials in .env
npm install
npm run dev        # starts on http://localhost:3001
```

---

## Step 3 — Expose Backend to Twilio (Development)

Twilio needs a public URL for your webhook. Use **ngrok**:

```bash
npx ngrok http 3001
# Copy the https URL, e.g. https://abc123.ngrok.io
```

In Twilio Console → **Messaging → Settings → WhatsApp Sandbox Settings**:
- Set "When a message comes in" to:  
  `https://abc123.ngrok.io/api/whatsapp/webhook`
- Method: `HTTP POST`

---

## Step 4 — Add the OTP Component to Your App

In any page or modal in your React app:

```tsx
import WhatsAppOTPVerification from '@/components/whatsapp/WhatsAppOTPVerification';

// Show it when a user needs to verify their WhatsApp number:
<WhatsAppOTPVerification
  onVerified={(phone) => {
    console.log('Verified:', phone);
    // Save phone to user profile, Supabase, etc.
  }}
  onClose={() => setShowOTP(false)}
/>
```

The component calls your backend at `/api/whatsapp/send-otp` and `/api/whatsapp/verify-otp`.

---

## Step 5 — Proxy API Calls in Development

Add this to your `vite.config.ts` so React can reach the Express backend:

```ts
export default defineConfig({
  // ...existing config...
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
```

---

## How the WhatsApp Bot Works

When a client messages your Twilio WhatsApp number:

```
Client WhatsApp → Twilio → POST /api/whatsapp/webhook
                              ↓
                       aiHandler.processMessage()
                              ↓
                       Keyword match → reply text
                              ↓
                       Twilio API → Client WhatsApp
```

**Keywords handled:** `hi/hello`, `appointment`, `prescription`, `emergency`,
`location/hours`, `services`, `billing/insurance`, `human/agent`, `thanks/bye`

---

## Upgrading to a Real LLM (Future)

In `backend/services/aiHandler.js`, replace the `getBotReply` function body:

```js
// OpenAI example:
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function getBotReply(message, history) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are HealthFirst\'s friendly patient assistant...' },
      ...history,
      { role: 'user', content: message },
    ],
  });
  return completion.choices[0].message.content;
}
```

No other files need to change.

---

## Production Checklist

- [ ] Set `TWILIO_WEBHOOK_VALIDATE=true` in production `.env`
- [ ] Use a real WhatsApp Business number (not sandbox)
- [ ] Replace in-memory OTP store with Redis (`ioredis`)
- [ ] Replace in-memory sessions with Supabase or Redis
- [ ] Add rate limiting (e.g. `express-rate-limit`) to `/send-otp`
- [ ] Store verified contacts in Supabase `contacts` table
- [ ] Set up proper logging (e.g. Winston, Datadog)
