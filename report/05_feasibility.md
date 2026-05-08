
# CHAPTER 5: FEASIBILITY STUDY

A feasibility study was conducted to evaluate whether the proposed system is practical, achievable, and worthwhile from technical, economic, and operational perspectives.

---

## 5.1 Technical Feasibility

Technical feasibility assesses whether the required technology, tools, and expertise are available to build and deploy the system.

### Assessment: **FEASIBLE** ✓

| Factor | Analysis |
|--------|----------|
| **Frontend Technology** | React 19 with TypeScript is a mature, widely-adopted technology with extensive community support, comprehensive documentation, and a rich ecosystem of libraries. The developer has prior experience with React development. |
| **Backend Infrastructure** | Supabase provides a fully managed PostgreSQL database, authentication, file storage, and serverless edge functions — eliminating the need to set up and maintain a custom backend server. This significantly reduces the technical complexity and development time. |
| **AI Integration** | ElevenLabs provides well-documented REST APIs and webhook-based integration for conversational AI. The integration involves receiving webhook callbacks and making API calls, which is standard web development practice. |
| **WhatsApp Integration** | Meta's WhatsApp Cloud API provides official, documented endpoints for sending template messages. The integration uses Supabase Edge Functions as a middleware layer, which is a proven pattern. |
| **Deployment** | Vercel provides zero-configuration deployment for React/Vite applications with automatic builds from GitHub pushes. Supabase handles all backend infrastructure. No DevOps expertise is required. |
| **Development Tools** | All tools used (VS Code, Git, npm, Node.js) are free, open-source, and cross-platform. No proprietary or expensive development tools are needed. |
| **Skills Available** | The developer possesses working knowledge of JavaScript/TypeScript, React, SQL, REST APIs, and Git — all essential skills for this project. |

**Conclusion**: The project is technically feasible. All required technologies are mature, well-documented, and within the developer's skill set. The use of Supabase as a BaaS significantly reduces backend complexity.

---

## 5.2 Economic Feasibility

Economic feasibility evaluates whether the project can be developed and maintained within a reasonable budget.

### Assessment: **FEASIBLE** ✓

#### Development Costs

| Item | Cost | Notes |
|------|------|-------|
| Development Hardware | ₹0 | Existing laptop used for development |
| IDE / Code Editor | ₹0 | VS Code is free and open-source |
| Supabase (Free Tier) | ₹0 | Free tier provides 500 MB database, 1 GB storage, 50,000 monthly active users |
| Vercel (Free Tier) | ₹0 | Free tier provides 100 GB bandwidth, automatic HTTPS, global CDN |
| GitHub (Free Tier) | ₹0 | Free for public and private repositories |
| Domain Name | ₹800/year | For the public website (99care.org) — borne by the company |
| ElevenLabs API | Usage-based | Free tier available; production costs borne by the company |
| WhatsApp Cloud API | Usage-based | First 1,000 conversations/month free; costs borne by the company |
| **Total Development Cost** | **₹0** | All tools used are free/open-source |

#### Operational Costs (Monthly — Post-Deployment)

| Item | Estimated Cost | Notes |
|------|---------------|-------|
| Supabase Pro Plan | ₹2,100/mo (~$25) | For production-grade features (8 GB DB, 100 GB storage) |
| Vercel Pro | ₹1,680/mo (~$20) | For commercial use and team features |
| ElevenLabs API | ₹4,000–8,000/mo | Based on call volume (estimated 200–500 calls/month) |
| WhatsApp API | ₹1,000–3,000/mo | Based on message volume |
| **Total Monthly** | **~₹9,000–15,000/mo** | Borne entirely by 99 Care |

**Conclusion**: The project is economically feasible. The development cost is effectively zero due to the use of free and open-source tools. Operational costs are modest and appropriate for a growing healthcare business. The ROI is expected to be positive within 2–3 months of deployment through reduced administrative staff costs and increased lead conversion.

---

## 5.3 Operational Feasibility

Operational feasibility evaluates whether the system can be successfully adopted and used by the target users in the organization.

### Assessment: **FEASIBLE** ✓

| Factor | Analysis |
|--------|----------|
| **User Interface** | The system uses a clean, modern UI with intuitive navigation (sidebar menu, tab-based views, card layouts). No specialized training is required — users familiar with web-based tools (email, social media) can operate the system. |
| **Accessibility** | As a web application, the system is accessible from any device with a modern browser — desktop, laptop, tablet, or smartphone. No software installation is required. |
| **Learning Curve** | The system is designed with a low learning curve. Common patterns (search bars, dropdown menus, form inputs, buttons) follow standard web conventions that users are already familiar with. |
| **Data Migration** | The existing data (worker records, client lists) can be imported into the system through the Supabase database interface or the application's built-in forms. |
| **Support & Maintenance** | The codebase follows a modular architecture with clear separation of concerns. This makes it straightforward for a developer to maintain, debug, and extend the system in the future. |
| **Organizational Readiness** | 99 Care's management is committed to digital transformation and actively participated in defining requirements and providing feedback during development. |
| **Backup & Recovery** | Supabase provides automatic daily backups of the PostgreSQL database. Point-in-time recovery is available on the Pro plan, ensuring data safety. |

**Conclusion**: The project is operationally feasible. The web-based architecture ensures universal accessibility, and the intuitive UI design minimizes the need for user training. The company's management is supportive and engaged in the adoption process.

---

### Overall Feasibility Summary

| Dimension | Status | Remarks |
|-----------|--------|---------|
| Technical | ✓ Feasible | Mature tech stack, developer has required skills |
| Economic | ✓ Feasible | Zero development cost, modest operational costs |
| Operational | ✓ Feasible | Intuitive UI, universal access, management support |

**The project has been determined to be feasible across all three dimensions and is approved for development.**

---
