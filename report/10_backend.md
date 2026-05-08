
# CHAPTER 10: BACK-END DESCRIPTION

## 10.1 Database Structure

The backend of 99Care OS is built on **Supabase**, an open-source Backend-as-a-Service (BaaS) platform that provides a managed **PostgreSQL 15** database, authentication, file storage, real-time subscriptions, and serverless edge functions — all accessible through auto-generated REST and GraphQL APIs.

### Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                   CLIENT (Browser)                    │
│            React 19 + TypeScript + Vite               │
└──────────────┬───────────────────────┬────────────────┘
               │ REST API (HTTPS)      │ Realtime (WS)
               ▼                       ▼
┌──────────────────────────────────────────────────────┐
│                   SUPABASE PLATFORM                   │
│  ┌────────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │  PostgREST │ │ GoTrue   │ │ Supabase Storage  │   │
│  │  (REST API)│ │  (Auth)  │ │ (S3-compatible)   │   │
│  └─────┬──────┘ └────┬─────┘ └────────┬──────────┘   │
│        │              │                │              │
│        ▼              ▼                ▼              │
│  ┌──────────────────────────────────────────────┐     │
│  │          PostgreSQL 15 Database              │     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │     │
│  │  │employees │ │crm_leads │ │worker_assign.│  │     │
│  │  │attendance│ │payroll   │ │id_card_links │  │     │
│  │  │clients   │ │call_trans│ │emp_documents │  │     │
│  │  └──────────┘ └──────────┘ └──────────────┘  │     │
│  │       Row Level Security (RLS) Policies      │     │
│  └──────────────────────────────────────────────┘     │
│                                                       │
│  ┌──────────────────────────────────────────────┐     │
│  │       Supabase Edge Functions (Deno)         │     │
│  │  • elevenlabs-call-webhook                   │     │
│  │  • meta-whatsapp-outbound                    │     │
│  │  • send-id-card-link                         │     │
│  │  • get-call-audio                            │     │
│  │  • get-elevenlabs-calls                      │     │
│  │  • send-contact-email                        │     │
│  │  • razorpay-webhook                          │     │
│  │  • drip-campaign                             │     │
│  │  • status-engine                             │     │
│  └──────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
               │                       │
               ▼                       ▼
┌──────────────────┐    ┌──────────────────────────┐
│  ElevenLabs AI   │    │ Meta WhatsApp Cloud API  │
│  (Voice Agent)   │    │  (Messaging Platform)    │
└──────────────────┘    └──────────────────────────┘
```

---

## 10.2 Data Storage and Handling

### 10.2.1 Database (PostgreSQL via Supabase)

All structured data is stored in a PostgreSQL 15 relational database managed by Supabase. The key aspects of data handling include:

- **Auto-generated UUIDs**: All records use `gen_random_uuid()` for primary keys, ensuring globally unique and non-sequential identifiers.
- **Database Triggers**: Custom PostgreSQL triggers handle automatic operations:
  - `generate_employee_id_trigger`: Auto-generates sequential employee IDs in the format `EMP-000001` upon insertion into the `employees` table.
  - `set_updated_at_trigger`: Automatically updates the `updated_at` column whenever a record is modified.
- **Soft Deletion**: Employee records use a `deleted_at` column for soft deletion, allowing recovery from the recycle bin.
- **Check Constraints**: Status fields use CHECK constraints to enforce valid values (e.g., `status IN ('available', 'assigned', 'inactive')`).

### 10.2.2 File Storage (Supabase Storage)

Binary files are stored in Supabase Storage, an S3-compatible object storage service:

- **`employee-photos` bucket**: Stores employee profile photographs. Files are uploaded with unique random names under the `photos/` directory.
- **`employee-photos/documents/` path**: Stores scanned ID proofs and certificates uploaded during employee onboarding, organized by employee UUID.
- **Public URLs**: Uploaded files are served via auto-generated public URLs for display in the application.

### 10.2.3 Authentication Data

User authentication is managed by **GoTrue** (Supabase Auth):

- **Virtual Email Strategy**: Admin usernames are mapped to virtual email addresses (e.g., `admin` → `admin@staff.healthcare`) to work with Supabase's email-based auth system.
- **JWT Tokens**: Successful authentication returns a JWT token that is stored in the browser and sent with every API request.
- **Session Management**: Supabase's client library handles automatic session refresh and token renewal.

---

## 10.3 Queries and Logic

### 10.3.1 Supabase Edge Functions

Edge Functions are serverless TypeScript functions that run on the Deno runtime at the edge (close to users). They handle external API integrations and webhook processing:

| Edge Function | Purpose | Trigger |
|---------------|---------|---------|
| `elevenlabs-call-webhook` | Receives call completion webhooks from ElevenLabs AI, extracts transcript/summary/lead data, and inserts into `call_transcripts` table. Auto-creates CRM lead. | HTTP POST (webhook from ElevenLabs) |
| `get-elevenlabs-calls` | Fetches call history from ElevenLabs API and syncs with local database. Returns enriched call data. | HTTP GET (from CRM dashboard) |
| `get-call-audio` | Proxies audio file requests to ElevenLabs API. Streams the call recording audio to the browser audio player. | HTTP GET (from audio player component) |
| `meta-whatsapp-outbound` | Sends WhatsApp template messages via Meta's Cloud API. Handles greeting messages, follow-ups, and notifications. | HTTP POST (from CRM module) |
| `send-id-card-link` | Sends the digital ID card shareable link to a client via WhatsApp. Formats the message with employee name, job title, and URL. | HTTP POST (from assignment service) |
| `send-contact-email` | Processes contact form submissions from the public website and sends notification emails. | HTTP POST (from contact page) |
| `razorpay-webhook` | Handles payment confirmation webhooks from Razorpay payment gateway. | HTTP POST (webhook from Razorpay) |
| `drip-campaign` | Manages scheduled follow-up message sequences for leads in the pipeline. | Scheduled / HTTP POST |
| `status-engine` | Processes automated pipeline stage transitions based on business rules. | HTTP POST |
| `send-joining-link` | Sends onboarding/joining links to newly assigned healthcare workers. | HTTP POST |
| `resend-email` | Handles email resend operations for various system notifications. | HTTP POST |
| `whatsapp-elevenlabs-bot` | Handles inbound WhatsApp messages and routes them to the AI conversational agent for automated responses. | HTTP POST (webhook from Meta WhatsApp) |

### 10.3.2 Key Database Queries

The application communicates with the database through Supabase's JavaScript client library (`@supabase/supabase-js`), which translates method calls into REST API requests. Key query patterns include:

**1. Fetching Available Employees (with filters)**
```
supabase.from('employees')
  .select('*')
  .eq('status', 'available')
  .is('assigned_client', null)
  .is('deleted_at', null)
  .order('full_name', { ascending: true })
```

**2. Creating a Worker Assignment (with compensation)**
```
Step 1: INSERT into worker_assignments
Step 2: UPDATE employees SET status = 'assigned'
Step 3: UPDATE crm_leads SET pipeline_stage = 'Staff Assigned'
Step 4: INSERT into id_card_links (generate secure token)
Step 5: INVOKE send-id-card-link Edge Function
```

**3. Releasing a Worker (with full cleanup)**
```
Step 1: UPDATE id_card_links SET is_active = false
Step 2: UPDATE worker_assignments SET assignment_status = 'cancelled'
Step 3: UPDATE employees SET status = 'available', assigned_client = null
Step 4: UPDATE crm_leads SET assigned_worker_name = null
```

**4. Attendance Marking (Upsert)**
```
supabase.from('attendance')
  .upsert({ worker_id, date, status })
  .select()
```

### 10.3.3 Row Level Security (RLS)

All tables have RLS policies that ensure data isolation and access control:

- **Authenticated users only**: All SELECT, INSERT, UPDATE, and DELETE operations require a valid JWT token.
- **Public access**: The `id_card_links` table allows anonymous SELECT access for token-based public ID card viewing.
- **Service role bypass**: Edge Functions use the `service_role` key to bypass RLS when performing system-level operations (e.g., webhook processing).

---
