
# CHAPTER 7: SOFTWARE/SYSTEM DESIGN

## 7.1 System Flowchart

The following flowchart illustrates the overall flow of the 99Care OS system from user entry to the various functional modules:

```mermaid
flowchart TD
    A[User Visits Website / Admin Portal] --> B{Authenticated?}
    B -->|No - Public User| C[Public Website]
    B -->|No - Admin| D[Login Page]
    B -->|Yes| E[Admin Dashboard]

    C --> C1[Home Page]
    C --> C2[Services Page]
    C --> C3[Appointment Booking]
    C --> C4[Contact Page]
    C --> C5[Blog]
    C --> C6["Public ID Card (via Token)"]

    C3 --> C3a[Submit Appointment Form]
    C3a --> C3b[Auto-Create CRM Lead]
    C3b --> C3c[Confirmation Page]

    D --> D1[Enter Username & Password]
    D1 --> D2{Valid Credentials?}
    D2 -->|No| D3[Show Error]
    D3 --> D1
    D2 -->|Yes| E

    E --> F[CRM Module]
    E --> G[HR Module]
    E --> H[Billing Module]
    E --> I[Clients Module]
    E --> J[Access Control]

    F --> F1[Kanban Pipeline]
    F --> F2[Call Logs & Audio]
    F --> F3[AI Lead Capture]
    F --> F4[WhatsApp Messaging]

    G --> G1[Available Workers]
    G --> G2[Worker Assignment]
    G --> G3[Active Deployments]
    G --> G4[Employee Directory]
    G --> G5[Attendance Tracking]
    G --> G6[Recycle Bin]

    G2 --> G2a[Select Client]
    G2a --> G2b[Create Assignment Record]
    G2b --> G2c[Generate ID Card Link]
    G2c --> G2d[Send WhatsApp Notification]
    G2d --> G2e[Update CRM Stage]
```

---

## 7.2 Data Flow Diagram — Level 0 (Context Diagram)

The context diagram shows the system as a single process with its external entities:

```mermaid
flowchart LR
    Patient["Patient / Client"]
    Admin["Admin / Staff"]
    Worker["Healthcare Worker"]
    AI["ElevenLabs AI Agent"]
    WA["WhatsApp Cloud API"]

    Patient -->|"Appointment Request, Inquiries"| System["99Care OS"]
    System -->|"Appointment Confirmation, ID Card Link"| Patient

    Admin -->|"Manage Leads, Assign Workers, Generate Bills"| System
    System -->|"Dashboard Data, Reports, Notifications"| Admin

    Worker -->|"Attendance Check-In"| System
    System -->|"Assignment Details, ID Card"| Worker

    AI -->|"Call Transcripts, Lead Data"| System
    System -->|"Call Log Queries"| AI

    WA -->|"Message Delivery Status"| System
    System -->|"Template Messages, Greetings"| WA
```

---

## 7.3 Data Flow Diagram — Level 1

The Level 1 DFD breaks the system into its major processes:

```mermaid
flowchart TD
    subgraph External["External Entities"]
        Client["Patient / Client"]
        Admin["Admin User"]
        EL["ElevenLabs AI"]
        WA["WhatsApp API"]
    end

    subgraph DS["Data Stores"]
        D1[("crm_leads")]
        D2[("employees")]
        D3[("worker_assignments")]
        D4[("attendance")]
        D5[("payroll")]
        D6[("call_transcripts")]
        D7[("id_card_links")]
    end

    P1["1.0 Lead Management"]
    P2["2.0 Workforce Management"]
    P3["3.0 Assignment & ID Cards"]
    P4["4.0 Attendance & Payroll"]
    P5["5.0 Communication Engine"]
    P6["6.0 Authentication & Access Control"]

    Client -->|"Appointment / Inquiry"| P1
    EL -->|"Call Data & Transcript"| P1
    P1 -->|"Store Lead"| D1
    P1 -->|"Store Transcript"| D6
    Admin -->|"Manage Leads"| P1

    Admin -->|"Add/Edit Workers"| P2
    P2 -->|"Store Employee Data"| D2
    P2 -->|"Read Employee Data"| D2

    Admin -->|"Assign Worker to Client"| P3
    P3 -->|"Read Available Workers"| D2
    P3 -->|"Create Assignment"| D3
    P3 -->|"Generate ID Card Link"| D7
    P3 -->|"Update Employee Status"| D2
    P3 -->|"Update Lead Stage"| D1
    P3 -->|"Send ID Card via WhatsApp"| P5

    Admin -->|"Mark Attendance"| P4
    P4 -->|"Store Attendance"| D4
    P4 -->|"Read Rates from"| D2
    P4 -->|"Generate Payroll"| D5

    P5 -->|"Send Templates"| WA
    WA -->|"Delivery Status"| P5
    P5 -->|"Greeting to"| Client

    Admin -->|"Login Credentials"| P6
    P6 -->|"Validate & Issue JWT"| Admin
```

---

## 7.4 Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    EMPLOYEES {
        uuid id PK
        text employee_id UK
        text full_name
        text job_title
        text photo_url
        text status
        text phone
        text aadhaar_number
        text address
        date dob
        text preferred_payment_type
        text[] services
        numeric hourly_rate
        numeric monthly_daily_rate
        numeric short_term_daily_rate
        integer shift_hours
        text experience
        text gender
        text assigned_client
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    CRM_LEADS {
        uuid id PK
        text name
        text phone
        text whatsapp_number
        text email
        text pipeline_stage
        text service_interest
        numeric estimated_value
        text source
        text priority
        text assigned_worker_name
        text assigned_worker_role
        timestamptz created_at
    }

    CLIENTS {
        uuid id PK
        text client_name
        text company_name
        text phone_number
        text email
        timestamptz created_at
    }

    WORKER_ASSIGNMENTS {
        uuid id PK
        uuid employee_id FK
        uuid client_id FK
        timestamptz assigned_at
        text assignment_status
        text notes
        numeric deposit_paid
    }

    ID_CARD_LINKS {
        uuid id PK
        uuid employee_id FK
        uuid assignment_id FK
        text token UK
        boolean is_active
        timestamptz expires_at
        timestamptz created_at
    }

    ATTENDANCE {
        uuid id PK
        uuid worker_id FK
        date date
        text status
        text notes
        timestamptz created_at
    }

    PAYROLL {
        uuid id PK
        uuid worker_id FK
        text month
        numeric total_days
        numeric present_days
        numeric daily_rate
        numeric total_amount
        text status
        timestamptz created_at
    }

    CALL_TRANSCRIPTS {
        uuid id PK
        text conversation_id
        text phone
        text transcript
        text summary
        text intent
        text captured_name
        text captured_whatsapp
        numeric captured_value
        text status
        uuid lead_id FK
        timestamptz created_at
    }

    EMPLOYEE_DOCUMENTS {
        uuid id PK
        uuid employee_id FK
        text file_url
        text file_name
        text file_type
        timestamptz created_at
    }

    EMPLOYEES ||--o{ WORKER_ASSIGNMENTS : "assigned via"
    CLIENTS ||--o{ WORKER_ASSIGNMENTS : "receives"
    WORKER_ASSIGNMENTS ||--o{ ID_CARD_LINKS : "generates"
    EMPLOYEES ||--o{ ID_CARD_LINKS : "has"
    EMPLOYEES ||--o{ ATTENDANCE : "tracks"
    EMPLOYEES ||--o{ PAYROLL : "earns"
    EMPLOYEES ||--o{ EMPLOYEE_DOCUMENTS : "uploads"
    CRM_LEADS ||--o{ CALL_TRANSCRIPTS : "linked to"
```

---

## 7.5 Use Case Diagram

```mermaid
flowchart TD
    subgraph Actors
        Admin["🧑‍💼 Admin"]
        Client["🏠 Client / Patient"]
        Worker["👩‍⚕️ Healthcare Worker"]
        AI["🤖 AI Voice Agent"]
    end

    subgraph UseCases["99Care OS — Use Cases"]
        UC1["Login / Authenticate"]
        UC2["View Dashboard"]
        UC3["Manage CRM Pipeline"]
        UC4["View Call Logs"]
        UC5["Send WhatsApp Greeting"]
        UC6["Add Lead to Pipeline"]
        UC7["Add New Employee"]
        UC8["Assign Worker to Client"]
        UC9["Generate Digital ID Card"]
        UC10["Track Attendance"]
        UC11["Calculate Payroll"]
        UC12["Manage Access Control"]
        UC13["Book Appointment Online"]
        UC14["View Public ID Card"]
        UC15["Handle Inbound Call"]
        UC16["Auto-Capture Lead Data"]
        UC17["Release Worker from Client"]
        UC18["Manage Recycle Bin"]
        UC19["Generate Invoice PDF"]
        UC20["Browse Services"]
    end

    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4
    Admin --> UC5
    Admin --> UC6
    Admin --> UC7
    Admin --> UC8
    Admin --> UC9
    Admin --> UC10
    Admin --> UC11
    Admin --> UC12
    Admin --> UC17
    Admin --> UC18
    Admin --> UC19

    Client --> UC13
    Client --> UC14
    Client --> UC20

    Worker --> UC14

    AI --> UC15
    AI --> UC16
```

---

## 7.6 Class Diagram

```mermaid
classDiagram
    class Employee {
        +String id
        +String employee_id
        +String full_name
        +String job_title
        +String photo_url
        +String status
        +String phone
        +String[] services
        +Number hourly_rate
        +Number monthly_daily_rate
        +create()
        +updateStatus()
        +softDelete()
        +restore()
    }

    class CRMLead {
        +String id
        +String name
        +String phone
        +String pipeline_stage
        +String service_interest
        +Number estimated_value
        +updateStage()
        +assignWorker()
        +sendGreeting()
    }

    class WorkerAssignment {
        +String id
        +String employee_id
        +String client_id
        +String assignment_status
        +Number deposit_paid
        +create()
        +complete()
        +cancel()
        +release()
    }

    class IDCardLink {
        +String id
        +String token
        +Boolean is_active
        +DateTime expires_at
        +generate()
        +deactivate()
        +buildShareableUrl()
    }

    class Attendance {
        +String id
        +String worker_id
        +Date date
        +String status
        +markPresent()
        +bulkMarkPresent()
    }

    class Payroll {
        +String id
        +String worker_id
        +String month
        +Number total_amount
        +calculate()
        +generatePDF()
    }

    class WhatsAppService {
        +sendGreeting()
        +sendIDCardLink()
        +sendTemplate()
    }

    class AuthService {
        +login()
        +logout()
        +checkPermission()
    }

    Employee "1" --> "*" WorkerAssignment
    Employee "1" --> "*" Attendance
    Employee "1" --> "*" Payroll
    WorkerAssignment "1" --> "1" IDCardLink
    CRMLead "1" --> "0..1" WorkerAssignment
    WorkerAssignment ..> WhatsAppService : uses
    AuthService ..> Employee : authenticates
```

---

## 7.7 Sequence Diagram — Lead Intake Flow (AI Voice Call)

```mermaid
sequenceDiagram
    actor Caller as Patient/Caller
    participant EL as ElevenLabs AI Agent
    participant WH as Webhook (Edge Function)
    participant DB as Supabase Database
    participant WA as WhatsApp API
    participant Admin as CRM Dashboard

    Caller->>EL: Dials 99 Care number
    EL->>Caller: AI greets and asks about service needed
    Caller->>EL: Describes requirements (service, schedule, budget)
    EL->>EL: Extracts structured data (name, service, WhatsApp, value)
    EL->>WH: POST webhook with transcript + extracted data
    WH->>DB: INSERT into call_transcripts
    WH->>DB: INSERT/UPDATE crm_leads (auto-capture)
    WH->>WA: Send WhatsApp greeting to caller
    WA-->>Caller: Receives greeting template message
    Admin->>DB: Opens CRM Dashboard
    DB-->>Admin: Displays new lead in pipeline + call log with audio
```

---

## 7.8 Sequence Diagram — Worker Assignment Flow

```mermaid
sequenceDiagram
    actor Admin as Admin User
    participant UI as WorkerAllocation UI
    participant AS as Assignment Service
    participant DB as Supabase Database
    participant WA as WhatsApp API
    participant Client as Client/Patient

    Admin->>UI: Clicks "Assign" on available worker
    UI->>UI: Opens AssignDialog (search/select client)
    Admin->>UI: Selects client, enters notes & deposit
    UI->>AS: assignWorkerToClient(empId, clientId, notes, deposit)
    AS->>DB: Check for existing active assignment
    AS->>DB: INSERT worker_assignments (status: active)
    AS->>DB: UPDATE employees (status: assigned, assigned_client)
    AS->>DB: UPDATE crm_leads (stage: Staff Assigned)
    AS->>AS: Generate secure random token (32 hex chars)
    AS->>DB: INSERT id_card_links (token, is_active: true)
    AS->>AS: Build shareable URL
    AS->>WA: Send ID card link to client via WhatsApp
    WA-->>Client: Receives WhatsApp with worker ID card link
    AS-->>UI: Return success (URL, whatsappSent status)
    UI-->>Admin: Shows success screen with shareable link
```

---
