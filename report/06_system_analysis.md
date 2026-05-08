
# CHAPTER 6: SYSTEM ANALYSIS

## 6.1 Functional Requirements

Functional requirements define the specific behavior and functions that the system must perform. The following table categorizes the functional requirements by module:

### Table 6.1: Functional Requirements

#### A. Public Website Module
| FR ID | Requirement | Priority |
|-------|------------|----------|
| FR-01 | The system shall display a responsive home page with service highlights, testimonials, and call-to-action buttons. | High |
| FR-02 | The system shall provide a detailed services page listing all healthcare services offered by 99 Care. | High |
| FR-03 | The system shall allow visitors to book appointments through an online form, capturing name, phone, email, preferred date/time, and service type. | High |
| FR-04 | The system shall display a confirmation page after successful appointment booking. | Medium |
| FR-05 | The system shall provide a public-facing digital ID card page accessible via a unique shareable token URL. | High |
| FR-06 | The system shall include About, Contact, Blog, Privacy Policy, and Terms pages. | Medium |
| FR-07 | The system shall be installable as a PWA on mobile devices. | Low |

#### B. Authentication & Access Control Module
| FR ID | Requirement | Priority |
|-------|------------|----------|
| FR-08 | The system shall provide a login page with username and password authentication. | High |
| FR-09 | The system shall support role-based access control (RBAC) with module-level permissions (CRM, HR, Clients, Finance). | High |
| FR-10 | The system shall redirect unauthenticated users to the login page when accessing admin routes. | High |
| FR-11 | The system shall allow administrators to create, edit, and delete staff accounts with specific module access. | High |

#### C. CRM Module
| FR ID | Requirement | Priority |
|-------|------------|----------|
| FR-12 | The system shall display leads in a Kanban-style pipeline board with draggable cards across configurable stages. | High |
| FR-13 | The system shall allow manual creation of new leads with name, phone, email, service interest, and estimated value. | High |
| FR-14 | The system shall integrate with ElevenLabs to receive AI voice call data (transcripts, summaries, caller info) via webhooks. | High |
| FR-15 | The system shall display call logs with audio playback, AI-generated summaries, and captured lead data. | High |
| FR-16 | The system shall auto-capture leads from AI voice calls and add them to the pipeline. | High |
| FR-17 | The system shall send automated WhatsApp greeting messages to new leads. | High |
| FR-18 | The system shall allow assigning healthcare workers to leads directly from the CRM. | High |
| FR-19 | The system shall support lead stage transitions with automatic status updates and notifications. | Medium |
| FR-20 | The system shall track call transcripts linked to specific leads. | Medium |

#### D. HR / Workforce Management Module
| FR ID | Requirement | Priority |
|-------|------------|----------|
| FR-21 | The system shall allow adding new employees with profile details (name, job title, photo, phone, Aadhaar, address, DOB, services, payment type, rates, documents). | High |
| FR-22 | The system shall display available workers in a card-based grid view with search and filter capabilities. | High |
| FR-23 | The system shall support assigning workers to clients, generating a digital ID card link, and sending it via WhatsApp. | High |
| FR-24 | The system shall display active deployments (assignments) in a table with actions for ID card preview, link resend, release, and terminate. | High |
| FR-25 | The system shall provide a full employee directory with status filters (All, Available, Assigned, Inactive). | High |
| FR-26 | The system shall display a confirmation warning when changing an assigned worker's status to available. | High |
| FR-27 | The system shall support soft-delete with a recycle bin for deleted employees. | Medium |
| FR-28 | The system shall track daily attendance with bulk mark-present functionality. | High |
| FR-29 | The system shall generate digital ID cards with employee details, photo, and company branding. | High |
| FR-30 | The system shall allow editing employee details (job title, phone, address, payment rates). | Medium |

#### E. Billing & Finance Module
| FR ID | Requirement | Priority |
|-------|------------|----------|
| FR-31 | The system shall calculate payroll based on attendance records and configured payment rates. | High |
| FR-32 | The system shall generate PDF invoices for client billing. | Medium |
| FR-33 | The system shall display financial summaries and reports. | Medium |

---

## 6.2 Non-Functional Requirements

Non-functional requirements define the quality attributes and constraints of the system.

### Table 6.2: Non-Functional Requirements

| NFR ID | Category | Requirement |
|--------|----------|------------|
| NFR-01 | **Performance** | The system shall load any page within 3 seconds on a standard broadband connection. |
| NFR-02 | **Performance** | The system shall support at least 50 concurrent admin users without degradation. |
| NFR-03 | **Security** | All data transmission shall be encrypted using HTTPS/TLS. |
| NFR-04 | **Security** | User authentication shall use JWT tokens with session expiration. |
| NFR-05 | **Security** | Database access shall be controlled through Row Level Security (RLS) policies. |
| NFR-06 | **Security** | Public ID card links shall use cryptographically secure random tokens (32-byte hex). |
| NFR-07 | **Usability** | The system shall have a responsive design supporting screen sizes from 320px (mobile) to 4K (desktop). |
| NFR-08 | **Usability** | The system shall follow consistent design patterns using the shadcn/ui component library. |
| NFR-09 | **Reliability** | The system shall have 99.9% uptime, ensured by Supabase and Vercel's SLA guarantees. |
| NFR-10 | **Reliability** | The database shall have automatic daily backups with point-in-time recovery. |
| NFR-11 | **Scalability** | The system architecture shall support horizontal scaling through Vercel's edge network and Supabase's managed PostgreSQL. |
| NFR-12 | **Maintainability** | The codebase shall use TypeScript for type safety and shall follow a modular component architecture. |
| NFR-13 | **Compatibility** | The system shall be compatible with the latest two versions of Chrome, Safari, Firefox, and Edge browsers. |
| NFR-14 | **SEO** | The public-facing website shall implement SEO best practices including meta tags, semantic HTML, and proper heading hierarchy. |

---

## 6.3 Existing System Overview

Before the development of 99Care OS, the company operated using the following manual and fragmented processes:

| Function | Existing Method | Limitations |
|----------|----------------|-------------|
| **Lead Tracking** | Phone calls noted in a notebook; WhatsApp messages saved in chat | Leads lost, no prioritization, no follow-up tracking |
| **Worker Management** | Excel spreadsheet with names, phone numbers, and status | No real-time updates, no photo/document management, prone to errors |
| **Worker Assignment** | Manual phone calls to check availability, then inform client via WhatsApp | Time-consuming (15–20 min per assignment), no audit trail |
| **Identity Verification** | Paper ID cards (sometimes none) | Easily lost/forged, no digital verification for clients |
| **Attendance** | Paper register maintained by the worker or client | Unreliable, disputes about presence, no centralized record |
| **Payroll** | Manual calculation in Excel based on attendance register | Errors, delays, disputes, no support for multiple rate types |
| **Client Communication** | Individual WhatsApp messages from personal phones | Inconsistent tone, no templates, missed follow-ups |
| **Website** | Basic WordPress site with limited functionality | No appointment booking, no integration with operations |

The proposed system addresses all the limitations listed above by providing a unified, automated, and intelligent platform.

---
