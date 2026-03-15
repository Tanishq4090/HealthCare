# 99 Care CRM — Technical Handoff for Antigravity

## What this system is

A WhatsApp-first CRM for 99 Care, a home healthcare agency in Surat.
Clients inquire via WhatsApp → AI bot collects details → staff gets assigned →
deposit collected → service runs → monthly billing auto-generated.

Stack: **React + TypeScript + Vite (frontend) · Supabase (DB + Edge Functions) · Twilio (WhatsApp)**

---

## Repository

https://github.com/Tanishq4090/HealthCare

Existing: React + TypeScript + Vite + Supabase already set up.
All files below drop into this repo with no stack changes needed.

---

## Files delivered

```
supabase/
  migrations/
    001_initial_schema.sql        ← Run first. All tables, enums, triggers, functions.
    002_idempotency_and_transitions.sql  ← Run second. Dedup + status guard.
  functions/
    whatsapp/
      index.ts                    ← Twilio webhook. Entry point for all WhatsApp messages.
      attendance.ts               ← START/END commands from staff. Imported by index.ts.
    status-engine/
      index.ts                    ← Fires on every leads.status change. Sends WhatsApp + creates records.

src/pages/
  CRMDashboard.tsx                ← Pipeline kanban + Clients table + Invoices table.
  StaffMatcher.tsx                ← Match staff to open service requests. Confirm assignment.
  AttendancePage.tsx              ← Today live view + log + per-staff summary.
```

---

## Database — 9 tables

| Table | Purpose |
|---|---|
| `leads` | Every WhatsApp inquiry. Bot state machine lives here. |
| `clients` | Converted leads. Gets permanent `client_code`. |
| `service_requests` | What service, shift, rate for each client. |
| `staff` | Caregiver profiles, skills, languages, availability. |
| `staff_assignments` | Which staff is assigned to which client. |
| `attendance` | START/END check-ins per assignment per day. |
| `invoices` | Deposit + monthly invoices. Auto-numbered. |
| `payments` | Payment records. `recorded_by = auto | admin`. |
| `communications` | Every WhatsApp message logged both directions. |

**Key design decisions:**
- `leads.inquiry_answers` is JSONB — each service type has different questions, no nullable columns
- `leads.status` drives all automation via DB webhook → status-engine function
- `leads.current_bot_state` drives the WhatsApp conversation separately
- `attendance.check_in_method` stores `whatsapp | qr | gps | manual` — upgradeable later

**Two SQL functions (callable via `supabase.rpc()`):**
- `calculate_lead_score(lead_id)` — scores 0–100 based on city, urgency, shift type
- `match_staff(service, languages, gender, area)` — returns top 5 staff ranked by match

---

## Lead status lifecycle

```
new → inquiry → quote_sent → form_submitted → staff_searching
→ staff_confirmed → deposit_pending → deposit_received
→ active → monthly_billing → closed
```

Every transition is enforced by a Postgres `BEFORE UPDATE` trigger.
Invalid transitions throw an exception — can't skip stages by accident.
Admin override: `UPDATE leads SET status_override = true, status = 'target' WHERE id = ...`

---

## WhatsApp bot — how it works

1. Message arrives at Twilio
2. Twilio POSTs form-encoded data to: `https://PROJECT.supabase.co/functions/v1/whatsapp`
3. `index.ts` checks `MessageSid` for duplicates (idempotency)
4. Checks if sender is staff → runs `attendance.ts` if START/END command
5. Otherwise: looks up or creates lead, advances bot state machine, saves to `inquiry_answers`
6. Returns TwiML XML response to Twilio

**Fuzzy input handling** — users don't type exact options. Normalize() resolves:
- Numbers: `"1"` → first option
- Partial: `"baby"` → `"Baby Care"`
- Hindi: `"बेबी"`, `"रात"`, `"हाँ"`, `"खत्म"` all mapped
- If nothing matches: re-prompts same question, never crashes

**Services supported:** Baby Care, Old Age Care, Nursing Care, Japa Care, Physiotherapy, Injection Service

**Staff attendance via WhatsApp:**
- Staff sends `START` → check-in logged, confirmation sent
- Staff sends `END` → check-out logged, hours calculated, confirmation sent
- Works in English + Hindi (`शुरू` / `खत्म` / `आया` / `गया` etc.)
- System distinguishes staff from clients by checking `staff.whatsapp_number`

---

## Status engine automations

| Status | What fires automatically |
|---|---|
| `new` | Lead score calculated |
| `quote_sent` | WhatsApp quote with pricing + form link |
| `form_submitted` | WhatsApp acknowledgment sent |
| `deposit_pending` | Deposit invoice generated + WhatsApp sent |
| `deposit_received` | Invoice marked paid, client activated, confirmation sent |
| `active` | Service started WhatsApp sent |
| `monthly_billing` | Attendance counted → invoice generated → WhatsApp bill sent |

Trigger setup in Supabase: Database → Webhooks → Create webhook on `leads` table, UPDATE event, POST to `status-engine` function URL.

---

## Frontend pages

### CRMDashboard.tsx
- **Pipeline tab:** Kanban columns for every status. Realtime via Supabase subscriptions.
  Click card → detail drawer with inquiry answers, conversation log, manual status buttons.
- **Clients tab:** Table of all clients with WhatsApp links, deposit status.
- **Invoices tab:** Table with overdue highlighting. "Remind" button opens WhatsApp with pre-filled message.
- Stats bar: total leads, active clients, pending payment amount, revenue this month.

### StaffMatcher.tsx
- Left panel: open service requests awaiting staff
- Right panel: top 5 staff matches from `match_staff()` RPC, ranked by score
- Confirm button: creates `staff_assignments` row, marks staff as assigned, advances lead to `staff_confirmed` (triggers deposit invoice)

### AttendancePage.tsx
- **Today tab:** Live cards — who's on duty, who finished, realtime updates
- **Log tab:** Full attendance table, last 7 or 30 days
- **Summary tab:** Per-staff card with days worked, absent count, avg hours/day, live status

---

## Deployment steps

### 1. Run migrations
In Supabase SQL Editor:
1. Run `001_initial_schema.sql`
2. Run `002_idempotency_and_transitions.sql`

### 2. Set secrets
```bash
supabase secrets set WHATSAPP_API_KEY=your_twilio_auth_token
supabase secrets set WHATSAPP_SOURCE_NUMBER=whatsapp:+14155238886
```

### 3. Deploy functions
```bash
supabase functions deploy whatsapp
supabase functions deploy status-engine
```

### 4. Wire Twilio
Twilio Console → Messaging → WhatsApp → Sandbox → "When a message comes in":
`https://YOUR_PROJECT.supabase.co/functions/v1/whatsapp` (HTTP POST)

### 5. Wire DB webhook
Supabase → Database → Webhooks → New:
- Table: `leads`, Event: UPDATE
- URL: `https://YOUR_PROJECT.supabase.co/functions/v1/status-engine`

### 6. Set environment variables in Vite
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 7. Add routes in App.tsx
```tsx
import CRMDashboard  from "./pages/CRMDashboard";
import StaffMatcher  from "./pages/StaffMatcher";
import AttendancePage from "./pages/AttendancePage";

<Route path="/"           element={<CRMDashboard />} />
<Route path="/match"      element={<StaffMatcher />} />
<Route path="/attendance" element={<AttendancePage />} />
```

### 8. Monthly billing cron (pg_cron — enable in Supabase dashboard first)
```sql
SELECT cron.schedule(
  'monthly-billing',
  '0 9 1 * *',
  $$
    UPDATE leads SET status = 'monthly_billing'
    WHERE converted_client_id IN (SELECT id FROM clients WHERE status = 'active')
    AND status = 'active';
  $$
);
```

---

## What is NOT built yet

| Feature | Notes |
|---|---|
| Auth / login | No admin login yet. Add Supabase Auth + RLS policies. |
| Staff portal | Staff have no login. Currently WhatsApp only. |
| Razorpay integration | Payment links not wired. `payments` table is ready for webhook. |
| Google Form → CRM sync | Form submission currently manual. Can be automated via webhook or Zapier. |
| Push notifications | No browser alerts when new lead arrives. Supabase Realtime handles live updates. |

---

## Business rules (from 99 Care's terms doc)

- Deposit: ₹15,000 before service starts
- 10-hour shift rate: ₹850/day (full month) · ₹1,050/day (incomplete month)
- 24-hour rate: ₹1,700/day
- Monthly bill sent on 1st, due by 5th
- If client cancels after 2-day trial: charged ₹1,050/day
- Staff replacement: arranged if leave > 1 day (subject to availability)
- Payment discussion with staff is prohibited

These rules are encoded in the WhatsApp bot quotes and invoice generation logic.

---

## Contact / questions

Project owner: Tanishq  
GitHub: https://github.com/Tanishq4090/HealthCare  
99 Care WhatsApp: +91 9016116564
