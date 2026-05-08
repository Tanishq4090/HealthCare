
# CHAPTER 4: OBJECTIVE OF THE SOFTWARE

## 4.1 Primary Objectives

The primary objectives of the 99Care OS system are:

1. **To design and develop a centralized healthcare operations management platform** that consolidates all critical business functions — CRM, HR, billing, and client communication — into a single, unified web application accessible from any device.

2. **To automate the lead management lifecycle** from initial inquiry (via phone call, WhatsApp, or website form) through qualification, staff assignment, and conversion to an active client, using AI-powered voice agents and automated messaging.

3. **To build an intelligent workforce allocation system** that enables administrators to manage healthcare worker profiles, track availability, assign workers to clients, and generate verifiable digital identity cards with secure shareable links.

4. **To implement automated client communication** via the WhatsApp Business API, enabling the system to send greeting messages, appointment confirmations, staff assignment notifications, and ID card links without manual intervention.

5. **To develop a comprehensive attendance and payroll management module** that tracks daily worker attendance, supports multiple payment structures (hourly, daily, monthly), and automates payroll calculations.

---

## 4.2 Secondary Objectives

1. **To create a professional public-facing website** for 99 Care that showcases services, enables online appointment booking, and serves as a marketing and SEO presence for the business.

2. **To implement role-based access control (RBAC)** that allows the system administrator to create staff accounts with specific module-level permissions, ensuring data security and operational segregation.

3. **To integrate AI-powered voice interaction** using ElevenLabs' Conversational AI platform, enabling the system to handle inbound phone calls, extract lead information (name, service needed, budget), and auto-populate the CRM pipeline.

4. **To ensure data security and privacy** through Supabase's Row Level Security (RLS) policies, JWT-based authentication, and secure token-based access for public-facing resources (ID cards).

5. **To build the system as a Progressive Web App (PWA)** that can be installed on mobile devices for quick access, providing a near-native app experience without requiring app store distribution.

6. **To design the system architecture for scalability**, using cloud-hosted infrastructure (Supabase + Vercel) with serverless edge functions that can scale automatically based on demand.

---

## 4.3 Expected Outcomes

Upon successful completion and deployment, the system is expected to deliver the following outcomes:

| # | Expected Outcome | Measurement |
|---|-----------------|-------------|
| 1 | **Reduction in lead response time** from hours to seconds through automated AI call handling and WhatsApp greetings | < 30 seconds for automated first contact |
| 2 | **Elimination of manual spreadsheet-based worker tracking** with a digital directory supporting search, filter, and real-time status updates | 100% digital workforce management |
| 3 | **Automated staff assignment workflow** including client notification via WhatsApp with digital ID card link | < 2 minutes per assignment vs. 15–20 minutes manual |
| 4 | **Accurate payroll calculation** with configurable rate structures and automatic attendance-based computation | Zero calculation errors |
| 5 | **Professional online presence** with a modern, responsive, SEO-optimized public website | Accessible on all devices |
| 6 | **Digital identity verification** for healthcare workers through secure, shareable ID card links | Unique token per assignment |
| 7 | **Centralized data visibility** through a real-time admin dashboard displaying key business metrics | Single source of truth |
| 8 | **Reduced administrative overhead** enabling the company to manage a larger workforce without proportional staff increase | 60–70% reduction in manual effort |

---
