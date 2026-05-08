
# CHAPTER 13: TESTING AND IMPLEMENTATION

## 13.1 Types of Testing

The 99Care OS system was tested using a combination of testing methodologies to ensure reliability, correctness, and usability across all modules.

### 13.1.1 Unit Testing
Individual components, service functions, and utility modules were tested in isolation to verify that each unit of code performs its intended function correctly.

**Focus Areas:**
- Employee service functions (create, update, delete, restore)
- Assignment service functions (assign, deactivate, release)
- Phone number normalization utility
- Token generation and URL building functions
- Form validation schemas (Zod)

### 13.1.2 Integration Testing
Interactions between connected modules were tested to verify that data flows correctly across system boundaries.

**Focus Areas:**
- CRM lead creation → Worker assignment → ID card generation → WhatsApp notification (end-to-end assignment flow)
- AI call webhook → Call transcript storage → CRM lead auto-capture
- Appointment booking → CRM lead creation via database trigger
- Employee soft-delete → Recycle bin → Permanent delete with cascade cleanup

### 13.1.3 System Testing
The complete system was tested as a whole to verify that all modules work together correctly in a production-like environment.

**Focus Areas:**
- Full user workflows from login to task completion
- Cross-module interactions (CRM → HR → Billing)
- Concurrent user access
- Data consistency across modules

### 13.1.4 User Acceptance Testing (UAT)
The system was presented to the client (99 Care management) for validation against their real-world operational requirements.

**Focus Areas:**
- Business workflow accuracy
- UI/UX intuitiveness and ease of use
- Data accuracy (correct calculations, proper status updates)
- WhatsApp message delivery and formatting
- ID card design and content

---

## 13.2 Test Case Design

### Table 13.1: Test Cases — CRM Module

| Test Case ID | Description | Input Data | Expected Output | Actual Output | Status |
|-------------|-------------|-----------|-----------------|---------------|--------|
| TC-CRM-01 | Add a new lead manually | Name: "Test Patient", Phone: "9876543210", Service: "Elderly Care", Value: 15000 | Lead appears in "New Inquiry" stage of Kanban board | Lead created successfully and displayed in pipeline | Pass |
| TC-CRM-02 | Move lead between pipeline stages | Drag lead card from "New Inquiry" to "Form Submitted" | Lead card moves to the new column; stage updated in database | Stage updated correctly | Pass |
| TC-CRM-03 | View AI call log with audio | Navigate to Call Logs tab | Call entries displayed with audio player, AI summary, and transcript button | All call data rendered correctly with working audio playback | Pass |
| TC-CRM-04 | Auto-capture lead from AI call | AI call completes with caller name "John Doe" | Lead auto-created in pipeline with captured name and details | Lead created with correct data | Pass |
| TC-CRM-05 | Send WhatsApp greeting | Click "Send Greeting" on a lead with valid phone | Greeting sent; button changes to "Greeting Sent" | Message delivered; status updated | Pass |
| TC-CRM-06 | Send greeting to invalid phone | Click "Send Greeting" on lead with phone "12345" | Error toast shown; "Retry Greeting" button displayed | Error handled gracefully | Pass |
| TC-CRM-07 | Display phone and WhatsApp in call logs | View lead data captured section | Both phone number and WhatsApp number shown with icons | Both numbers displayed correctly | Pass |

### Table 13.2: Test Cases — HR Module

| Test Case ID | Description | Input Data | Expected Output | Actual Output | Status |
|-------------|-------------|-----------|-----------------|---------------|--------|
| TC-HR-01 | Add new employee | Full name: "Priya Sharma", Job Title: "Nurse", Photo uploaded | Employee created with auto-generated ID (EMP-XXXXXX); appears in Available Workers tab | Employee created; ID generated; displayed in grid | Pass |
| TC-HR-02 | Assign worker to client | Select available worker → Select client from CRM → Submit | Assignment created; worker status changes to "Assigned"; WhatsApp sent to client with ID card link | All steps completed; WhatsApp delivered | Pass |
| TC-HR-03 | Assign worker to client with existing assignment | Try to assign when client already has active staff | Error message: "This lead already has a staff member assigned" | Error displayed correctly | Pass |
| TC-HR-04 | Release worker from assignment | Click "Release" on active deployment → Confirm | Worker status reverts to "Available"; assignment cancelled; ID card link deactivated; CRM lead updated | All cleanup operations completed | Pass |
| TC-HR-05 | Change assigned worker to available (safety warning) | In Directory, change status of assigned worker to "Available" | Confirmation dialog appears warning about releasing from client | Dialog shown with warning message | Pass |
| TC-HR-06 | Confirm status change after warning | Click "Yes, Make Available" in confirmation dialog | Worker released, status updated, assignment cancelled | Worker released successfully | Pass |
| TC-HR-07 | Cancel status change after warning | Click "Cancel" in confirmation dialog | No changes; worker remains "Assigned" | Status unchanged | Pass |
| TC-HR-08 | Soft-delete employee | Click Delete on an employee → Confirm | Employee hidden from main lists; appears in Recycle Bin | Soft-delete successful; appears in trash | Pass |
| TC-HR-09 | Restore soft-deleted employee | Click "Restore" in Recycle Bin | Employee reappears in main lists with previous status | Restore successful | Pass |
| TC-HR-10 | Permanent delete with cascade | Click "Delete Permanently" in Recycle Bin | Employee and all related records (assignments, ID cards, attendance, payroll, documents) permanently removed | Cascade delete successful | Pass |
| TC-HR-11 | Mark daily attendance | Select date → Mark workers as Present/Absent/Leave | Attendance records created/updated via upsert | Records saved correctly | Pass |
| TC-HR-12 | Bulk mark all present | Click "Bulk Mark Present" button | All pending workers marked as "Present" for the selected date | All records updated | Pass |
| TC-HR-13 | Upload employee documents | Add new employee with 2 ID proof photos | Documents uploaded to Supabase Storage; records created in employee_documents table | Files uploaded; records linked | Pass |

### Table 13.3: Test Cases — Authentication & Access Control

| Test Case ID | Description | Input Data | Expected Output | Actual Output | Status |
|-------------|-------------|-----------|-----------------|---------------|--------|
| TC-AUTH-01 | Valid admin login | Username: "admin", Password: "password123" | Redirected to /admin dashboard | Login successful; dashboard loaded | Pass |
| TC-AUTH-02 | Invalid credentials | Username: "admin", Password: "wrongpass" | Error message: "Invalid username or password" | Error displayed correctly | Pass |
| TC-AUTH-03 | Empty fields | Submit with empty username and password | Error message: "Please enter both username and password" | Validation error shown | Pass |
| TC-AUTH-04 | Access protected route without login | Navigate to /admin/hr directly | Redirected to /login page | Redirect to login successful | Pass |
| TC-AUTH-05 | Staff user without HR access | Login as staff with only CRM permission; navigate to /admin/hr | Access denied or redirected | Module access restricted | Pass |

### Table 13.4: Test Cases — Public Website

| Test Case ID | Description | Input Data | Expected Output | Actual Output | Status |
|-------------|-------------|-----------|-----------------|---------------|--------|
| TC-PUB-01 | View public ID card via token | Navigate to /id-card/{valid-token} | Employee ID card displayed with photo, name, designation, and company branding | ID card rendered correctly | Pass |
| TC-PUB-02 | View expired/invalid ID card token | Navigate to /id-card/{invalid-token} | Error message: "ID card not found or expired" | Error page displayed | Pass |
| TC-PUB-03 | Submit appointment booking | Fill form with valid data and submit | Confirmation page shown; record created in appointments table; CRM lead auto-created | All steps completed | Pass |
| TC-PUB-04 | Responsive design on mobile | View website on 375px width screen | All elements properly sized and readable; hamburger menu for navigation | Fully responsive | Pass |
| TC-PUB-05 | PWA installation | Click "Install App" on supported browser | App installs to home screen; opens in standalone mode | PWA installed successfully | Pass |

---

## 13.3 Bug Reporting

The following bugs were identified and resolved during the testing phase:

| Bug ID | Description | Severity | Resolution |
|--------|-------------|----------|------------|
| BUG-01 | Duplicate key violation on `username` column when creating employees without a username | High | Removed `username` field from the INSERT query; updated unique constraint to be partial (`WHERE username IS NOT NULL`) |
| BUG-02 | WhatsApp greeting auto-trigger causing error toasts for call logs with invalid/missing phone numbers | Medium | Added phone number validation (minimum 10 digits) before auto-triggering the greeting |
| BUG-03 | Assigned workers could be changed to "Available" without releasing their client assignment | High | Added confirmation dialog with safety warning; implemented proper release flow via `deactivateIDCardLink` |
| BUG-04 | Phone number and WhatsApp number not displayed in call log lead data section | Low | Added Phone icon with `call.phone` and WhatsApp icon with `call.capturedWhatsapp` to the Lead Data Captured section |
| BUG-05 | Soft-deleted (trashed) workers appearing in the assignment picker dropdown | Medium | Added `.is('deleted_at', null)` filter to the available workers query |

---

## 13.4 Implementation Details

### Environment Setup

The system operates in two deployment modes:

1. **Public Website** (`VITE_APP_MODE=public`)
   - Deployed to Vercel on a custom domain (99care.org)
   - Contains only public-facing pages (Home, Services, Contact, Blog, etc.)
   - SEO-optimized with meta tags and sitemap

2. **OS Portal** (`VITE_APP_MODE=os`)
   - Deployed to Vercel on a separate subdomain
   - Contains both public pages and protected admin modules
   - `robots.txt` set to `noindex, nofollow` to prevent search engine indexing

### Deployment Steps

1. Code pushed to GitHub `main` branch
2. Vercel detects the push and triggers an automatic build
3. `tsc -b` runs TypeScript compilation for type checking
4. `vite build` creates optimized production bundles
5. Assets deployed to Vercel's global edge network
6. Service worker generated for PWA support
7. Application available at the configured domain within ~60 seconds

### Database Migrations

Database schema changes are managed through numbered SQL migration files in the `supabase/migrations/` directory. Each migration is applied using the Supabase CLI:

```
supabase db push
```

This ensures a versioned, reproducible database schema across development and production environments.

---
