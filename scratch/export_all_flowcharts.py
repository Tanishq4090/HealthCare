import os
import re
import base64
import urllib.request
import sys
import time

def main():
    md_path = "/Users/tanishqkachiwala/Downloads/Design/healthcare/report/07_system_design.md"
    output_dir = "/Users/tanishqkachiwala/Downloads/Design/healthcare/report/flowcharts"
    
    # 1. Create the flowcharts directory
    print(f"Creating directory: {output_dir}")
    os.makedirs(output_dir, exist_ok=True)
    
    # 2. Read the markdown file
    print(f"Reading markdown file: {md_path}")
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # We will define the exact diagram names and search pattern
    diagrams = {
        "7.1": {
            "name": "7_1_system_flowchart.png",
            "title": "System Flowchart"
        },
        "7.2": {
            "name": "7_2_context_diagram.png",
            "title": "Context Diagram — Level 0"
        },
        "7.3": {
            "name": "7_3_dfd_level_1.png",
            "title": "Data Flow Diagram — Level 1"
        },
        "7.4": {
            "name": "7_4_erd.png",
            "title": "Entity Relationship Diagram (ERD)"
        },
        "7.5": {
            "name": "7_5_use_case.png",
            "title": "Use Case Diagram"
        },
        "7.6": {
            "name": "7_6_class_diagram.png",
            "title": "Class Diagram"
        },
        "7.7": {
            "name": "7_7_lead_intake_sequence.png",
            "title": "Sequence Diagram — Lead Intake Flow"
        },
        "7.8": {
            "name": "7_8_worker_assignment_sequence.png",
            "title": "Sequence Diagram — Worker Assignment Flow"
        }
    }
    
    # Locate all mermaid blocks in the markdown file
    # We can split the content by '## 7.' to extract the sections
    sections = content.split("## 7.")
    
    for section in sections[1:]:
        # Get section number (e.g. '1', '2', '3')
        first_line = section.split("\n")[0].strip()
        num_match = re.match(r"^(\d+)", first_line)
        if not num_match:
            continue
        
        num = "7." + num_match.group(1)
        if num not in diagrams:
            continue
            
        # Find the mermaid block
        mermaid_match = re.search(r"```mermaid\s*\n(.*?)\n```", section, re.DOTALL)
        if not mermaid_match:
            print(f"No mermaid block found for Section {num}")
            continue
            
        mermaid_code = mermaid_match.group(1).strip()
        
        # Build file paths
        png_name = diagrams[num]["name"]
        png_path = os.path.join(output_dir, png_name)
        
        print(f"\n--- Section {num}: {diagrams[num]['title']} ---")
        print(f"Code size: {len(mermaid_code)} characters")
        
        # Base64 URL-safe encode
        code_bytes = mermaid_code.encode("utf-8")
        b64_encoded = base64.b64encode(code_bytes).decode("utf-8")
        b64_encoded = b64_encoded.replace("+", "-").replace("/", "_")
        
        # We addbgColor=white to force a solid white background!
        url = f"https://mermaid.ink/img/{b64_encoded}?bgColor=white"
        print(f"URL: {url[:100]}...")
        
        # Fetch the rendered image with retries for resilience
        success = False
        for attempt in range(1, 4):
            try:
                req = urllib.request.Request(
                    url, 
                    headers={'User-Agent': 'Mozilla/5.0'}
                )
                with urllib.request.urlopen(req) as response:
                    image_data = response.read()
                
                with open(png_path, "wb") as f:
                    f.write(image_data)
                print(f"Successfully compiled and saved to: {png_name} (Size: {len(image_data)} bytes)")
                success = True
                break
            except Exception as e:
                print(f"  Attempt {attempt} failed: {e}")
                time.sleep(2)
                
        if not success:
            print(f"CRITICAL ERROR: Failed to render diagram for Section {num} after 3 attempts.")
            sys.exit(1)
            
    print("\n🎉 All 8 flowcharts compiled and saved to the 'flowcharts' directory successfully!")

if __name__ == "__main__":
    main()
