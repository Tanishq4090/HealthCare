
# CHAPTER 15: LIMITATIONS

The 99Care OS system, while fully functional and deployed in production, has the following limitations:

---

## 15.1 Current Constraints

| # | Limitation | Description | Impact |
|---|-----------|-------------|--------|
| 1 | **No Offline Mode for Admin Portal** | The admin portal (CRM, HR, Billing) requires an active internet connection. There is no offline data caching or queue system for admin operations. | Staff cannot manage operations during internet outages. |
| 2 | **Single-Language AI Agent** | The ElevenLabs AI voice agent is configured primarily for Hindi and English. It may not perform accurately for callers speaking in Gujarati or other regional languages. | Some callers may experience difficulty in communication with the AI agent. |
| 3 | **No Native Mobile App** | While the system is a PWA and works on mobile browsers, it does not have a dedicated native Android or iOS application. | Some mobile-specific features (push notifications, background sync) are limited compared to native apps. |
| 4 | **Large JavaScript Bundle** | The production JavaScript bundle is approximately 2.9 MB (807 KB gzipped). This is above the recommended 500 KB threshold for optimal performance on slow networks. | Initial load may be slower on 2G/3G connections. |
| 5 | **No Multi-Tenancy** | The system is designed for a single organization (99 Care). It does not support multiple healthcare companies sharing the same instance. | Cannot be offered as a SaaS product without architectural changes. |
| 6 | **Limited Reporting & Analytics** | The dashboard provides basic metrics but lacks advanced reporting features such as date-range comparisons, export to Excel, custom report generation, or trend analysis. | Management relies on manual analysis for deeper insights. |
| 7 | **No Automated Scheduling** | Worker assignments are manual. The system does not suggest optimal worker-client matches based on skills, location, availability, or past ratings. | Assignment optimization relies entirely on admin judgment. |
| 8 | **WhatsApp Template Dependency** | All WhatsApp messages must use pre-approved Meta templates. Free-form messaging is not supported through the system. | Communication flexibility is limited to approved template formats. |
| 9 | **No Payment Gateway for Clients** | While the system tracks deposits and billing, clients cannot make online payments directly through the platform. | Payment collection remains a manual or external process. |
| 10 | **Single Admin Level** | The RBAC system supports module-level permissions but does not have granular action-level permissions (e.g., "can view but not edit" within a module). | All users with module access have full CRUD permissions within that module. |

---
