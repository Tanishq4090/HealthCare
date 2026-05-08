
# CHAPTER 2: INTRODUCTION OF THE PROJECT

## 2.1 Background of the Project

The healthcare industry in India is undergoing a significant digital transformation. Home healthcare services, in particular, have seen tremendous growth in recent years, driven by an aging population, increasing chronic diseases, and the convenience of receiving medical care at home. However, many home healthcare companies still rely on manual processes for managing their operations — from tracking patient inquiries and assigning healthcare workers, to managing attendance, billing, and client communication.

**99 Care** is a home healthcare services provider based in Surat, Gujarat, that offers a wide range of services including elderly care, post-surgical care, baby care, physiotherapy, nursing, and more. Before the development of this system, the company relied on a fragmented set of tools — phone calls, spreadsheets, WhatsApp messages, and manual record-keeping — to manage their day-to-day operations.

The need for a centralized, intelligent, and automated operations management system became increasingly apparent as the company scaled its workforce and client base. This project was undertaken to address this critical gap by building **99Care OS** — a comprehensive, AI-powered healthcare operations management platform.

The system was developed as a full-stack web application using modern technologies including React, TypeScript, Supabase (PostgreSQL), and integrated with third-party AI services such as ElevenLabs for conversational AI voice agents and Meta's WhatsApp Cloud API for automated client communication.

---

## 2.2 Problem Statement

Home healthcare companies face several operational challenges that hinder their growth and efficiency:

1. **Fragmented Lead Management**: Incoming patient/client inquiries arrive through multiple channels — phone calls, WhatsApp messages, website forms — with no centralized system to track, prioritize, or follow up on them. Leads are frequently lost or delayed due to manual handling.

2. **Inefficient Workforce Allocation**: Assigning healthcare workers (nurses, attendants, therapists) to clients involves checking availability, matching skills, and managing schedules — all done manually through phone calls and spreadsheets, leading to delays and double-bookings.

3. **Lack of Communication Automation**: Post-inquiry follow-ups, appointment confirmations, staff assignment notifications, and review requests are all handled manually via individual WhatsApp messages, consuming significant staff time and leading to inconsistencies.

4. **No Digital Identity Management**: Healthcare workers visiting client homes had no standardized identity verification system. Paper-based ID cards were easily misplaced or forged, creating trust and safety concerns for clients.

5. **Manual Attendance and Payroll**: Tracking daily attendance of field workers and calculating their pay based on different rate structures (hourly, daily, monthly) was done through paper registers, resulting in errors and disputes.

6. **No Data-Driven Decision Making**: Without a centralized system, the company had no visibility into key metrics like lead conversion rates, worker utilization, revenue trends, or operational bottlenecks.

---

## 2.3 Need and Significance of the System

The significance of the 99Care OS system can be understood from the following perspectives:

### For the Business (99 Care)
- **Operational Efficiency**: Automating lead capture, worker assignment, attendance tracking, and billing reduces the time and effort required to manage daily operations by an estimated 60–70%.
- **Revenue Growth**: AI-powered call handling and automated WhatsApp follow-ups ensure no lead is missed, directly impacting conversion rates and revenue.
- **Scalability**: The cloud-based architecture allows the company to scale from managing 10 workers to 100+ without proportional increases in administrative overhead.
- **Data Visibility**: Real-time dashboards provide management with actionable insights into pipeline health, workforce utilization, and financial performance.

### For Clients (Patients and Families)
- **Trust and Safety**: Digital ID cards with shareable links allow clients to verify the identity and credentials of healthcare workers assigned to their home, enhancing trust and safety.
- **Better Communication**: Automated WhatsApp notifications keep clients informed about staff assignments, schedule changes, and service updates in real-time.
- **Convenient Booking**: The public-facing website allows clients to book appointments, explore services, and contact the company without the need for phone calls.

### For Healthcare Workers
- **Digital Identity**: Professional digital ID cards with unique shareable links provide workers with a verifiable identity that enhances their professional image.
- **Transparent Payroll**: Automated attendance tracking and payroll calculation ensure accurate and timely compensation.
- **Clear Assignments**: Workers receive clear assignment details including client information and service requirements through the system.

### Academic Significance
- This project demonstrates the practical application of modern web development technologies (React, TypeScript, Supabase) combined with AI services (ElevenLabs, Meta WhatsApp API) to solve real-world business problems.
- It showcases the integration of multiple complex subsystems — CRM, HR, billing, and communication — into a cohesive, production-ready application.
- The project provides hands-on experience with industry-standard tools and practices including version control (Git/GitHub), cloud hosting (Vercel), serverless functions, and real-time databases.

---
