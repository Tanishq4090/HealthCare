
# CHAPTER 11: IMPLEMENTATION

## 11.1 Module-Wise Explanation

The 99Care OS system is organized into six major modules, each responsible for a distinct area of the healthcare operations workflow.

### Module A: Public Website

The public-facing website serves as the digital storefront for 99 Care. It is built as a set of React pages wrapped in a shared `Layout` component that provides consistent navigation and footer.

**Key Pages:**
- **HomePage** — Hero section, service highlights, statistics, testimonials, and a WhatsApp chat widget
- **ServicesPage** — Grid of all healthcare services with animated entrance effects
- **ServiceDetailPage** — Detailed service descriptions with booking call-to-action
- **AppointmentPage** — Multi-field booking form with Zod validation; on submission, it creates a record in the `appointments` table and auto-triggers a CRM lead creation via a database trigger
- **ContactPage** — Contact form that invokes the `send-contact-email` Edge Function
- **BlogPage / BlogDetailPage** — Blog listing and detail pages for SEO and content marketing
- **PublicIDCard** — Token-authenticated page that displays a worker's digital ID card to clients for identity verification

**Technical Highlights:**
- All pages use Framer Motion for smooth page transitions and scroll-based animations
- SEO meta tags are dynamically set per page using the `SEOMeta` component
- The website is configured as a PWA with service worker caching for offline access
- Responsive design using TailwindCSS utility classes, tested across mobile, tablet, and desktop

---

### Module B: CRM (Customer Relationship Management)

The CRM module is the lead management hub, integrating AI voice calls and WhatsApp messaging into a visual pipeline.

**Sub-Features:**

1. **Kanban Pipeline Board**
   - Visual drag-and-drop interface with configurable stages: New Inquiry → Form Submitted → Staff Assigned → Deposit Pending → Trial in Progress → Active Client
   - Each lead card shows name, phone, estimated value, service interest, and assigned worker badge
   - Right-side inspector panel for viewing lead details, changing stage, editing values, and triggering AI follow-ups

2. **Call Logs & Audio**
   - Fetches call data from ElevenLabs via the `get-elevenlabs-calls` Edge Function
   - Displays call entries with caller name, type (Inbound/Outbound), duration, timestamp
   - Embedded audio player streams call recordings via the `get-call-audio` Edge Function
   - AI-generated summary and detected intent displayed alongside each call
   - "View Full Transcript" modal shows the complete conversation

3. **AI Lead Capture**
   - The `elevenlabs-call-webhook` Edge Function processes incoming call data
   - Extracts structured information: caller name, service interest, estimated value, WhatsApp number
   - Automatically creates a CRM lead in the pipeline
   - Links the call transcript to the created lead

4. **WhatsApp Integration**
   - Automated greeting messages sent to new leads via the `meta-whatsapp-outbound` Edge Function
   - Template-based messages following Meta's WhatsApp Business API requirements
   - Status tracking: Sending → Sent → Error with retry functionality
   - Phone number normalization (handling +91/91 prefix variations)

---

### Module C: HR / Workforce Management

The HR module is the largest and most complex module, handling the complete employee lifecycle.

**Sub-Features:**

1. **Employee Onboarding** (`Add New Employee` dialog)
   - Multi-field form: Name, Job Title, Photo, Phone, Aadhaar, Address, DOB, Gender, Experience
   - Service selection (multi-select): Elderly Care, Nursing, Baby Care, Physiotherapy, etc.
   - Payment configuration: Hourly/Monthly/Short-Term with corresponding rate inputs
   - Document upload: Multiple ID proofs stored via Supabase Storage
   - Photo upload with preview and crop support

2. **Available Workers Tab**
   - Card-based grid showing workers with `status = 'available'`
   - Each card displays photo, name, job title, service tags, and payment type
   - Actions: Assign (opens assignment dialog), Preview ID Card, Edit, Delete
   - Search bar with debounced input for filtering

3. **Worker Assignment Flow** (`assignWorkerToClient` service)
   - Step 1: Validate no existing active assignment for the client (single-staff rule)
   - Step 2: Create `worker_assignments` record with status 'active'
   - Step 3: Update employee status to 'assigned' and set `assigned_client`
   - Step 4: Update CRM lead stage to 'Staff Assigned'
   - Step 5: Generate cryptographically secure token (32 hex chars via `crypto.randomUUID`)
   - Step 6: Create `id_card_links` record with the token
   - Step 7: Send WhatsApp message to client with shareable ID card link
   - Compensation logic: If any step fails, previous steps are rolled back

4. **Active Deployments Tab**
   - Table view of all active worker-to-client assignments
   - Actions: Preview ID Card, Resend WhatsApp Link, Release Worker, Terminate Assignment
   - Release flow calls `deactivateIDCardLink` which handles full cleanup

5. **Employee Directory**
   - Full table view of all employees (excluding soft-deleted)
   - Status filter tabs: All, Available, Assigned, Inactive
   - Status change dropdown with safety confirmation dialog for "Assigned → Available" transitions
   - Confirmation warns about releasing the worker from their current client assignment

6. **Attendance Tracking**
   - Date-picker constrained to past/today dates
   - Lists all available/assigned workers for the selected date
   - Status options: Present, Absent, Paid Leave, Unpaid Leave, Half Day, Weekly Off
   - Bulk "Mark All Present" for quick daily operations
   - Stats header: Total, Present, Leave/Absent, Pending

7. **Digital ID Card Generation**
   - Professional card design with 99 Care branding, employee photo, name, designation, ID number
   - Shareable via unique token-based public URL
   - Download as image functionality using html2canvas
   - Print-ready layout

8. **Recycle Bin**
   - Soft-deleted employees shown in a separate tab
   - Restore individual employees
   - Permanent delete with full cascade cleanup (assignments, ID cards, attendance, payroll, documents)
   - "Empty Trash" for bulk permanent deletion

---

### Module D: Client Management

- **Client Master Database** displaying all clients with contact information
- Auto-populated from CRM leads when a worker is assigned
- Phone number display and WhatsApp contact integration
- Assignment history tracking per client

---

### Module E: Billing & Finance

- **Payroll Calculation** based on attendance records and configured payment rates
- Monthly payroll summary with worker-wise breakdown
- Support for multiple rate structures (hourly × shift hours, daily rate × present days)
- PDF invoice generation using jsPDF with autoTable for formatted output
- Export and print functionality

---

### Module F: Access Control & Authentication

- **Role-Based Access Control (RBAC)**: Administrators can create staff accounts with specific module-level permissions
- Module toggles: CRM, HR, Clients, Finance — each can be individually enabled/disabled per user
- Staff account management: Create, Edit, Delete accounts
- Virtual email authentication strategy (username → `username@staff.healthcare`)
- Protected routes check permissions before rendering module content

---

## 11.2 Working of the System

The system follows a client-server architecture where the React frontend communicates with the Supabase backend through REST APIs:

1. **User opens the application** → React Router determines the route and renders the appropriate component
2. **Authentication check** → `ProtectedRoute` component verifies JWT token and module permissions
3. **Data fetching** → Components use Supabase client library to query the database
4. **User actions** → Form submissions, button clicks trigger service functions that perform multi-step database operations
5. **External integrations** → Edge Functions handle webhook processing (ElevenLabs, WhatsApp) asynchronously
6. **Real-time updates** → Supabase Realtime subscriptions push database changes to connected clients

---

## 11.3 Technologies Used (Summary)

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | React 19 + TypeScript | Interactive UI components |
| Styling | TailwindCSS 3 | Utility-first CSS framework |
| Components | shadcn/ui (Radix) | Accessible, customizable UI components |
| Build | Vite 7 | Fast development server and production bundler |
| Backend | Supabase | Database, Auth, Storage, Edge Functions |
| Database | PostgreSQL 15 | Relational data storage |
| AI Voice | ElevenLabs | Conversational AI for phone calls |
| Messaging | Meta WhatsApp Cloud API | Automated template messages |
| Hosting | Vercel | Global edge deployment |
| Version Control | Git + GitHub | Source code management |

---
