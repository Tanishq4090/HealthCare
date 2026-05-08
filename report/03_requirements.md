
# CHAPTER 3: SOFTWARE/SYSTEM REQUIREMENT STUDY

## 3.1 Hardware Requirements

The system is a cloud-hosted web application and does not require specialized hardware for deployment. However, the following hardware specifications are recommended for development and end-user access:

### Table 3.1: Hardware Requirements

#### For Development
| Component | Minimum Requirement |
|-----------|-------------------|
| Processor | Intel Core i5 / Apple M1 or equivalent |
| RAM | 8 GB (16 GB recommended) |
| Storage | 256 GB SSD |
| Display | 13-inch, 1920×1080 resolution |
| Internet | Broadband with minimum 10 Mbps speed |

#### For End Users (Admin/Staff)
| Component | Minimum Requirement |
|-----------|-------------------|
| Device | Desktop, Laptop, Tablet, or Smartphone |
| Browser | Google Chrome 90+, Safari 15+, Firefox 88+, Edge 90+ |
| Internet | Broadband or 4G/5G mobile data |
| Screen Resolution | Minimum 1024×768 (responsive design supports all sizes) |

#### For Server/Hosting
| Component | Specification |
|-----------|--------------|
| Cloud Provider | Supabase (PostgreSQL 15, hosted on AWS) |
| Frontend Hosting | Vercel (Edge Network, Global CDN) |
| Storage | Supabase Storage (S3-compatible object storage) |
| Edge Functions | Supabase Edge Functions (Deno runtime) |

---

## 3.2 Software Requirements

### Table 3.2: Software Requirements

#### Development Environment
| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 20.x LTS | JavaScript runtime for development tooling |
| npm | 10.x | Package manager |
| Visual Studio Code | Latest | Primary code editor / IDE |
| Git | 2.x | Version control system |
| GitHub | — | Remote repository hosting |
| Supabase CLI | Latest | Local development and migration management |

#### Operating System Compatibility
| OS | Supported Versions |
|----|-------------------|
| Windows | Windows 10 / 11 |
| macOS | macOS 12 (Monterey) or later |
| Linux | Ubuntu 20.04 LTS or later |
| Mobile | Android 10+ / iOS 15+ (via browser) |

---

## 3.3 Tools and Technologies Used

### Table 3.3: Tools and Technologies

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Frontend Framework** | React | 19.2 | Component-based UI library for building interactive user interfaces |
| **Language** | TypeScript | 5.9 | Strongly-typed superset of JavaScript for type safety and developer experience |
| **Build Tool** | Vite | 7.x | Next-generation frontend build tool with fast HMR (Hot Module Replacement) |
| **CSS Framework** | Tailwind CSS | 3.4 | Utility-first CSS framework for rapid UI development |
| **UI Components** | shadcn/ui (Radix) | Latest | Accessible, customizable component library built on Radix UI primitives |
| **Icons** | Lucide React | 0.562 | Modern, consistent icon library with 1000+ icons |
| **Animations** | Framer Motion | 12.x | Production-ready motion library for React animations |
| **Charts** | Recharts | 2.15 | Composable charting library built on React and D3 |
| **Routing** | React Router DOM | 7.x | Client-side routing for single-page application navigation |
| **State Management** | TanStack React Query | 5.x | Data fetching and server state management library |
| **Backend (BaaS)** | Supabase | 2.97 | Open-source Firebase alternative providing PostgreSQL database, authentication, real-time subscriptions, storage, and edge functions |
| **Database** | PostgreSQL | 15 | Enterprise-grade relational database (managed by Supabase) |
| **Authentication** | Supabase Auth | — | JWT-based authentication with Row Level Security (RLS) |
| **File Storage** | Supabase Storage | — | S3-compatible object storage for employee photos and documents |
| **Serverless Functions** | Supabase Edge Functions | — | Deno-based serverless functions for backend logic (webhooks, API integrations) |
| **AI Voice Agent** | ElevenLabs | — | Conversational AI platform for voice-based lead intake and customer interaction |
| **Messaging API** | Meta WhatsApp Cloud API | — | Official WhatsApp Business API for automated template messages and notifications |
| **PDF Generation** | jsPDF + AutoTable | 4.x | Client-side PDF generation for invoices and reports |
| **Form Validation** | Zod + React Hook Form | 4.x / 7.x | Schema-based form validation and management |
| **Hosting** | Vercel | — | Frontend hosting with global edge network, automatic deployments from GitHub |
| **Version Control** | Git + GitHub | — | Source code versioning and collaboration |
| **PWA** | Vite PWA Plugin | 1.2 | Progressive Web App support for mobile installability and offline capabilities |

---
