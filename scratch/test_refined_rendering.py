import base64
import urllib.request
import os
import sys

def render_diagram(code, filename):
    output_path = f"/Users/tanishqkachiwala/Downloads/Design/healthcare/report/flowcharts/{filename}"
    print(f"Rendering: {filename}")
    
    code_bytes = code.encode("utf-8")
    b64_encoded = base64.b64encode(code_bytes).decode("utf-8")
    b64_encoded = b64_encoded.replace("+", "-").replace("/", "_")
    
    # bgColor=white for crisp contrast
    url = f"https://mermaid.ink/img/{b64_encoded}?bgColor=white"
    
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req) as response:
            image_data = response.read()
            
        with open(output_path, "wb") as f:
            f.write(image_data)
        print(f"  Saved visual to: {filename} (Size: {len(image_data)} bytes)")
        return True
    except Exception as e:
        print(f"  Error rendering {filename}: {e}")
        return False

def main():
    # 1. Refined 7.2 Context Diagram (IP/OP pipeline style)
    code_7_2 = """flowchart LR
    subgraph Inputs ["Data Inputs"]
        P_In["🧑 Patient (Bookings)"]
        A_In["🧑‍💼 Admin (HR/Billing Config)"]
        AI_In["🤖 ElevenLabs AI (Call Data)"]
        W_In["👩‍⚕️ Worker (Attendance)"]
    end

    System("💻 99Care OS Core")

    subgraph Outputs ["System Outputs"]
        P_Out["🧑 Patient (ID Cards / Confirmations)"]
        A_Out["🧑‍💼 Admin (Dashboards & Reports)"]
        W_Out["👩‍⚕️ Worker (Assignments)"]
        WA_Out["💬 WhatsApp Cloud API (Messages)"]
    end

    P_In --> System
    A_In --> System
    AI_In --> System
    W_In --> System

    System --> P_Out
    System --> A_Out
    System --> W_Out
    System --> WA_Out

    classDef input fill:#E3F2FD,stroke:#0D47A1,stroke-width:1.5px,color:#0D47A1;
    classDef system fill:#263238,stroke:#37474F,stroke-width:3px,color:#FFF,font-weight:bold;
    classDef output fill:#E8F5E9,stroke:#2E7D32,stroke-width:1.5px,color:#2E7D32;
    
    class P_In,A_In,AI_In,W_In input;
    class System system;
    class P_Out,A_Out,W_Out,WA_Out output;
"""

    # 2. Refined 7.5 Use Case Diagram (Concise Core Use Cases layout)
    code_7_5 = """flowchart LR
    subgraph Staff_AI ["Primary Operators"]
        Admin["🧑‍💼 Admin User"]
        AI["🤖 AI Voice Agent"]
    end

    subgraph UC ["Core Use Cases"]
        UC1["Manage CRM Pipeline"]
        UC2["Add Employee Profile"]
        UC3["Assign Worker to Client"]
        UC4["Track Attendance"]
        UC5["Calculate Payroll"]
        UC6["Handle Inbound Call"]
        UC7["Auto-Capture Lead"]
        UC8["Book Appointment"]
        UC9["Verify Worker ID Card"]
    end

    subgraph Client_Worker ["End Users"]
        Client["🏠 Patient / Client"]
        Worker["👩‍⚕️ Healthcare Worker"]
    end

    Admin --> UC1
    Admin --> UC2
    Admin --> UC3
    Admin --> UC4
    Admin --> UC5

    AI --> UC6
    AI --> UC7

    Client --> UC8
    Client --> UC9

    Worker --> UC9

    classDef actor fill:#E3F2FD,stroke:#0D47A1,stroke-width:1.5px,color:#0D47A1;
    classDef uc fill:#FFF,stroke:#333,stroke-width:1.5px;
    
    class Admin,AI,Client,Worker actor;
    class UC1,UC2,UC3,UC4,UC5,UC6,UC7,UC8,UC9 uc;
"""

    s1 = render_diagram(code_7_2, "7_2_context_diagram.png")
    s2 = render_diagram(code_7_5, "7_5_use_case.png")
    
    if s1 and s2:
        print("Both refined diagrams rendered successfully!")
    else:
        print("Rendering failed.")
        sys.exit(1)

if __name__ == "__main__":
    main()
