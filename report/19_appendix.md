
# CHAPTER 19: APPENDIX

## 19.1 Glossary of Terms

| Term | Definition |
|------|-----------|
| **BaaS** | Backend as a Service — a cloud service model that provides ready-to-use backend features (database, auth, storage) via APIs. |
| **Edge Function** | A serverless function that runs on servers geographically close to the user, reducing latency. |
| **Kanban** | A project management methodology that uses visual boards with columns to represent workflow stages. |
| **JWT** | JSON Web Token — a compact, URL-safe token format used for securely transmitting authentication information. |
| **RLS** | Row Level Security — a PostgreSQL feature that restricts which rows a user can access based on policies. |
| **PWA** | Progressive Web App — a web application that uses modern web capabilities to deliver app-like experiences. |
| **Webhook** | An HTTP callback that sends real-time data from one application to another when a specific event occurs. |
| **Upsert** | A database operation that inserts a new record or updates an existing one if a conflict is detected. |
| **Soft Delete** | A deletion strategy where records are marked as deleted (using a timestamp) rather than being physically removed. |
| **Deno** | A modern JavaScript/TypeScript runtime (used by Supabase Edge Functions) that is secure by default. |
| **CDN** | Content Delivery Network — a network of servers that delivers web content based on the user's geographic location. |

---

## 19.2 Project File Structure

```
healthcare/
├── public/                    # Static assets (favicon, PWA icons)
├── src/
│   ├── admin/                 # Admin module pages
│   │   ├── AdminLayout.tsx    # Sidebar navigation layout
│   │   ├── Dashboard.tsx      # Main dashboard
│   │   ├── CRM.tsx            # CRM pipeline & call logs
│   │   ├── HR.tsx             # HR workforce management
│   │   ├── Clients.tsx        # Client management
│   │   ├── Billing.tsx        # Billing & payroll
│   │   └── AccessControl.tsx  # RBAC settings
│   ├── components/
│   │   ├── hr/                # HR-specific components
│   │   │   ├── WorkerAllocation.tsx  # Worker tabs & assignment logic
│   │   │   └── EmployeeIDCard.tsx    # Digital ID card component
│   │   ├── layout/            # Navigation, header, footer
│   │   ├── ui/                # shadcn/ui components (Button, Dialog, etc.)
│   │   └── *.tsx              # Shared components (SEO, PWA, WhatsApp widget)
│   ├── contexts/              # React context providers (Auth)
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Supabase client initialization
│   ├── pages/
│   │   ├── public/            # Public website pages (Home, Services, etc.)
│   │   ├── ClientConfirmation.tsx
│   │   └── DutyTracker.tsx
│   ├── services/              # Business logic services
│   │   ├── assignmentService.ts    # Worker assignment flow
│   │   └── employeeService.ts      # Employee CRUD operations
│   ├── types/                 # TypeScript type definitions
│   ├── utils/                 # Utility functions
│   ├── App.tsx                # Root application with routing
│   ├── Login.tsx              # Authentication page
│   └── main.tsx               # Application entry point
├── supabase/
│   ├── functions/             # Edge Functions (12 functions)
│   │   ├── elevenlabs-call-webhook/
│   │   ├── meta-whatsapp-outbound/
│   │   ├── send-id-card-link/
│   │   ├── get-call-audio/
│   │   ├── get-elevenlabs-calls/
│   │   ├── whatsapp-elevenlabs-bot/
│   │   ├── send-contact-email/
│   │   ├── razorpay-webhook/
│   │   ├── drip-campaign/
│   │   ├── status-engine/
│   │   ├── send-joining-link/
│   │   └── resend-email/
│   └── migrations/            # SQL migration files (27 files)
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite build configuration
├── tailwind.config.js         # TailwindCSS configuration
└── vercel.json                # Vercel deployment configuration
```

---

## 19.3 Environment Variables

The following environment variables are required for the system (values are confidential and not disclosed):

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public API key |
| `VITE_APP_MODE` | Application mode: 'public' or 'os' |
| `VITE_APP_DOMAIN` | Domain identifier for dual-deploy |
| `VITE_APP_URL` | Application base URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for edge functions (server-side only) |
| `META_WHATSAPP_TOKEN` | Meta WhatsApp Cloud API access token |
| `META_PHONE_NUMBER_ID` | Meta WhatsApp phone number ID |
| `ELEVENLABS_API_KEY` | ElevenLabs API key |
| `RESEND_API_KEY` | Resend email service API key |

---

## 19.4 Deployment URLs

| Environment | URL | Purpose |
|------------|-----|---------|
| Public Website | https://99care.org | Customer-facing website |
| OS Portal | _(Confidential subdomain)_ | Admin operations portal |
| Supabase Dashboard | https://supabase.com/dashboard | Database and backend management |
| GitHub Repository | https://github.com/Tanishq4090/HealthCare | Source code (private) |

---

## 19.5 Video Demonstration

As per the NDC compliance requirement, a comprehensive video demonstration of the 99Care OS system has been prepared. The video covers:

1. **Public Website** — Home page, services, appointment booking, contact form
2. **Login & Authentication** — Admin login flow
3. **CRM Module** — Kanban pipeline, call logs with audio, AI lead capture, WhatsApp greetings
4. **HR Module** — Employee onboarding, available workers, worker assignment, active deployments, directory, attendance, ID cards, recycle bin
5. **Billing Module** — Payroll calculation, invoice generation
6. **Access Control** — Staff account management, permission configuration
7. **Public ID Card** — Token-based public access verification

The video is submitted alongside this report on the designated storage medium (Pen Drive / Google Drive).

---
