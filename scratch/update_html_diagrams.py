import re

def main():
    html_path = "/Users/tanishqkachiwala/Downloads/Design/tech-h0use/99care_full_report.html"
    
    print(f"Reading HTML file: {html_path}")
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # 1. Replace Figure 7.2 SVG
    # We look for <svg viewbox="0 0 500 480" ... </svg> right before Figure 7.2
    pattern_7_2 = r'<svg viewbox="0 0 500 480"[\s\S]*?</svg>'
    replacement_7_2 = '<img src="flowcharts/7_2_context_diagram.png" alt="DFD Level 0: Context diagram" style="max-width: 100%; height: auto; display: block; margin: 0 auto 10px auto; max-height: 480px;">'
    
    # We find if there is a match in content
    match_7_2 = re.search(pattern_7_2, content)
    if match_7_2:
        print("Found SVG for Figure 7.2, replacing...")
        content = re.sub(pattern_7_2, replacement_7_2, content, count=1)
    else:
        print("WARNING: Figure 7.2 SVG pattern not found!")

    # 2. Replace Figure 7.3 SVG
    # We look for <svg viewbox="0 0 540 600" ... </svg> right before Figure 7.3
    pattern_7_3 = r'<svg viewbox="0 0 540 600"[\s\S]*?</svg>'
    replacement_7_3 = '<img src="flowcharts/7_3_dfd_level_1.png" alt="DFD Level 1 diagram" style="max-width: 100%; height: auto; display: block; margin: 0 auto 10px auto; max-height: 520px;">'
    
    match_7_3 = re.search(pattern_7_3, content)
    if match_7_3:
        print("Found SVG for Figure 7.3, replacing...")
        content = re.sub(pattern_7_3, replacement_7_3, content, count=1)
    else:
        print("WARNING: Figure 7.3 SVG pattern not found!")

    # 3. Replace Figure 7.5 SVG
    # We look for <svg viewbox="0 0 500 610" ... </svg> right before Figure 7.5
    pattern_7_5 = r'<svg viewbox="0 0 500 610"[\s\S]*?</svg>'
    replacement_7_5 = '<img src="flowcharts/7_5_use_case.png" alt="Use Case diagram" style="max-width: 100%; height: auto; display: block; margin: 0 auto 10px auto; max-height: 520px;">'
    
    match_7_5 = re.search(pattern_7_5, content)
    if match_7_5:
        print("Found SVG for Figure 7.5, replacing...")
        content = re.sub(pattern_7_5, replacement_7_5, content, count=1)
    else:
        print("WARNING: Figure 7.5 SVG pattern not found!")

    print(f"Writing updated HTML file back to: {html_path}")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    print("HTML report updated successfully with the clean PNG diagrams!")

if __name__ == "__main__":
    main()
