
# CHAPTER 8: FRONT-END SCREENS

This chapter presents the key user interface screens of the 99Care OS system. Each screen is described with its purpose, key elements, and navigation context.

> **Note:** Screenshots of the actual running application should be inserted in place of the placeholders below. Capture these from the live system at `http://localhost:5173` (OS mode) and `http://localhost:5174` (public website mode).

---

## 8.1 Public Website — Home Page

**Purpose:** The landing page of the 99care.org public website. It serves as the first point of contact for potential clients and provides an overview of 99 Care's services.

**Key Elements:**
- Hero section with a prominent call-to-action ("Book Appointment")
- Service highlights (Elderly Care, Nursing, Baby Care, Physiotherapy, etc.)
- Statistics section (years of experience, happy patients, healthcare workers)
- Testimonials carousel
- WhatsApp chat widget for instant communication
- Responsive navigation with mobile hamburger menu

**Navigation:** Accessible at the root URL (`/`). Links to Services, About, Contact, and Appointment pages.

`[INSERT SCREENSHOT: Home Page — Full view]`

---

## 8.2 Public Website — Services Page

**Purpose:** Displays all healthcare services offered by 99 Care with descriptions and icons.

**Key Elements:**
- Grid of service cards with icons, titles, and brief descriptions
- Each card links to a detailed service page
- Animated entrance effects using Framer Motion

`[INSERT SCREENSHOT: Services Page]`

---

## 8.3 Public Website — Appointment Booking

**Purpose:** Allows potential clients to book an appointment online, which automatically creates a lead in the CRM pipeline.

**Key Elements:**
- Multi-field form: Name, Phone, Email, Service Type, Preferred Date/Time, Message
- Form validation with error messages
- Success confirmation page after submission
- Auto-triggers CRM lead creation via Supabase

`[INSERT SCREENSHOT: Appointment Booking Form]`

---

## 8.4 Login Screen

**Purpose:** Secure authentication gateway for admin and staff users.

**Key Elements:**
- Clean, centered card design with 99Care logo
- Username and password fields with validation
- Loading state with spinner during authentication
- Error message display for invalid credentials
- Responsive design for mobile and desktop

`[INSERT SCREENSHOT: Login Screen]`

---

## 8.5 Admin Dashboard

**Purpose:** The main landing page after login, providing a high-level overview of business metrics.

**Key Elements:**
- Summary cards (total leads, active workers, pending assignments, revenue)
- Quick-access navigation to all modules
- Recent activity feed
- Sidebar navigation with module icons (CRM, HR, Clients, Billing, Settings)

`[INSERT SCREENSHOT: Admin Dashboard]`

---

## 8.6 CRM — Kanban Pipeline View

**Purpose:** Visual pipeline management for tracking leads through various stages.

**Key Elements:**
- Draggable lead cards organized in columns by pipeline stage
- Stages: New Inquiry → Form Submitted → Staff Assigned → Deposit Pending → Trial in Progress → Active Client
- Each card displays lead name, phone, estimated value, and assigned worker badge
- Right-side inspector panel for lead details and actions
- Search and filter functionality

![CRM Kanban Board](crm_kanban.png)

---

## 8.7 CRM — Call Logs with AI Summary

**Purpose:** Displays AI-processed call recordings with transcripts and auto-captured lead data.

**Key Elements:**
- Call entries with caller name, type (Inbound/Outbound), duration, and timestamp
- Audio player for call playback
- AI-generated summary and detected intent
- "Lead Data Captured" section showing name, estimated value, phone number, and WhatsApp number
- "Send Greeting" and "Add to Pipeline" action buttons
- "View Full Transcript" button for complete call transcript modal

![Call Logs Section](call_logs.png)

---

## 8.8 HR — Available Workers Tab

**Purpose:** Displays all healthcare workers currently available for assignment.

**Key Elements:**
- Card-based grid layout with worker photo, name, job title, and availability status
- Service tags and payment type indicators
- "Assign" and "ID Card" action buttons on each card
- Search bar and refresh button
- Dropdown menu with Full Profile, Preview ID Card, Edit, and Delete options

![Available Workers Grid](hr_directory.png)

---

## 8.9 HR — Active Deployments Tab

**Purpose:** Shows all currently active worker-to-client assignments.

**Key Elements:**
- Table view with columns: Staff Member, ID No., Client Name, Deployment Date, Auth Link, Actions
- Actions: ID Card preview, Resend Link (WhatsApp), Release worker, Terminate assignment
- Release action includes an inline confirmation prompt
- Shareable link with copy button and external link

`[INSERT SCREENSHOT: Active Deployments Table]`

---

## 8.10 HR — Employee Directory

**Purpose:** Complete directory of all employees (available, assigned, inactive) with status management.

**Key Elements:**
- Table view with worker info, services & payment type, status badge, and quick actions
- Status filter tabs (All, Available, Assigned, Inactive)
- Status dropdown menu for changing worker status
- Confirmation dialog when moving from "Assigned" to "Available" (safety warning)
- Click-to-view full profile details
- Directory summary footer

`[INSERT SCREENSHOT: Employee Directory Table]`

---

## 8.11 HR — Attendance Matrix

**Purpose:** Daily attendance tracking for all active/assigned workers.

**Key Elements:**
- Date picker with max date constraint (today)
- Stats header showing Total, Present, Leaves/Absent, and Pending counts
- Linear list of workers with name, role, assigned client, and attendance status selector
- Status options: Present, Absent, Paid Leave, Unpaid Leave, Half Day, Weekly Off
- "Bulk Mark Present" button for quick batch operations

`[INSERT SCREENSHOT: Attendance Matrix]`

---

## 8.12 HR — Worker Assignment Dialog

**Purpose:** Modal dialog for assigning a worker to a client.

**Key Elements:**
- Employee info card with photo, name, job title, and employee ID
- Client search field with dropdown (searches CRM leads by name)
- Pipeline stage badge next to each client result
- Inline "Add New Client" form
- Notes textarea and deposit amount input
- Success screen showing shareable ID card link and WhatsApp status

`[INSERT SCREENSHOT: Assignment Dialog]`

---

## 8.13 HR — Digital ID Card Preview

**Purpose:** Preview of the digital employee ID card that gets shared with clients.

**Key Elements:**
- Professional ID card design with 99 Care branding
- Employee photo, name, designation, employee ID
- Personal details (Aadhaar, DOB, address, experience, gender)
- QR code or verification section
- Print/Save button for physical copy generation

`[INSERT SCREENSHOT: ID Card Preview Dialog]`

---

## 8.14 Billing Module

**Purpose:** Financial management including payroll calculation and invoice generation.

**Key Elements:**
- Payroll table with worker names, present days, rate, and total amount
- Month selector for viewing different pay periods
- PDF export button for invoice generation
- Summary cards for total payroll amount

![Billing Module](billing.png)

---

## 8.15 Access Control / Settings

**Purpose:** Role-based access management for staff accounts.

**Key Elements:**
- Staff member list with name, role, email, and permissions
- Add new staff member form
- Module-level permission toggles (CRM, HR, Clients, Finance)
- Edit and delete actions

`[INSERT SCREENSHOT: Access Control Page]`

---
