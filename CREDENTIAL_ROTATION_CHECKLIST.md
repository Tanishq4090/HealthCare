# Credential Rotation Checklist

> [!IMPORTANT]
> **DO NOT attempt to rotate credentials automatically.** These actions must be performed manually by the repository owner at each service provider dashboard.

## Step 1: Rotate Supabase Anon Key
1. **Navigate to:** [Supabase API Settings](https://supabase.com/dashboard/project/sgyladamwnanudnropwl/settings/api)
2. **Note:** Supabase anon keys are DESIGNED to be public (used client-side). However, if Row Level Security (RLS) is not properly configured, this key can be abused.
3. **Action Required:**
   - Verify **ALL** tables have Row Level Security (RLS) enabled.
   - Review existing RLS policies for over-permissive rules.
   - If any table lacks RLS or has weak policies, fix them immediately.
4. **Optional but Recommended:** Regenerate the anon key via the Supabase dashboard:
   - Go to **Settings** → **API** → Click **"Reset anon key"**.
5. **Update Environment Variables:** Update the new key in your local `.env` file AND in your production deployment environment variables (e.g., Vercel, Railway, etc.).

---

## Step 2: Rotate Meta WhatsApp Business API Token (HIGH PRIORITY)
> [!CAUTION]
> This is a high-priority leak. System tokens allow sending messages, reading contacts, and potentially being abused for spam or phishing.

1. **Navigate to:** [Meta Business System Users](https://business.facebook.com/settings/system-users)
2. **Identify User:** Find the System User associated with the token starting with `EAAW02FFTvBk...`.
3. **Generate & Revoke:** Click **"Generate New Token"** and revoke the old one.
4. **Select Permissions:** Ensure the following permissions are selected:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. **Secure Storage:** Copy the new token and store it **SECURELY** (e.g., a password manager or Supabase Secrets). **DO NOT** commit this to a `.env` file in the repository.
6. **Malicious Activity Check:** If you suspect the token was used maliciously:
   - Check **WhatsApp Business Manager** → **Insights** for unusual message volume.
   - Review billing for unexpected charges.
   - Contact Meta Business Support if abuse is detected.

---

## Step 3: ElevenLabs Agent ID
1. **Navigate to:** [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai)
2. **Sensitivity Note:** The "Agent ID" itself is less sensitive than an API key, but:
   - Check if your **ElevenLabs API KEY** was also exposed anywhere.
   - Regenerate the API key at [ElevenLabs API Settings](https://elevenlabs.io/app/settings/api-keys).
   - If the agent was configured with sensitive system prompts or knowledge bases, consider creating a new agent and deprecating the exposed one.

---

## Step 4: Meta Phone Number ID and WABA ID
1. **Status:** These are identifiers, not secrets—they cannot be "rotated".
2. **Risk Mitigation:** If the system token was compromised, bad actors may have mapped these IDs to your account.
3. **Monitoring:** Monitor your WhatsApp Business account for:
   - Unknown messages sent.
   - Changes to display name or profile.
   - Unexpected template message approvals.

---

## Step 5: Document What Was Exposed
Create an incident log containing:
- **Git Exposure:** Date/time the `.env` was first committed (check `git log`).
- **Discovery:** Date/time you discovered the exposure.
- **Remediation:** Date/time each credential was rotated.
- **Audit:** Any suspicious activity observed.
- **Impact:** Users/customers potentially affected (especially if data was accessed).

---

## Step 6: Determine Notification Requirements
> [!WARNING]
> If any customer data was accessible via the exposed credentials, you may have GDPR, CCPA, or HIPAA breach notification obligations.

For a healthcare CRM, this is especially critical. **Consult legal counsel** to determine if you are required by law to notify affected individuals or regulatory bodies.
