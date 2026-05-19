import base64
import urllib.request
import sys

def test_render(code, name):
    print(f"Testing diagram rendering for: {name}")
    code_bytes = code.encode("utf-8")
    b64_encoded = base64.b64encode(code_bytes).decode("utf-8")
    
    # URL safe replace
    b64_encoded = b64_encoded.replace("+", "-").replace("/", "_")
    
    url = f"https://mermaid.ink/img/{b64_encoded}"
    print(f"URL: {url[:100]}...")
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req) as response:
            image_data = response.read()
        print("  SUCCESS!")
        return image_data
    except Exception as e:
        print(f"  FAILED: {e}")
        return None

def main():
    # 1. Test simple diagram
    simple_code = "graph TD; A-->B; B-->C;"
    simple_img = test_render(simple_code, "Simple diagram")
    
    # 2. Test complex diagram
    with open("/Users/tanishqkachiwala/Downloads/Design/healthcare/scratch/flowchart.mmd", "r", encoding="utf-8") as f:
        complex_code = f.read().strip()
    complex_img = test_render(complex_code, "Complex diagram")
    
    if complex_img:
        print("Complex diagram rendered successfully!")
        with open("/Users/tanishqkachiwala/Downloads/Design/healthcare/scratch/flowchart.png", "wb") as f:
            f.write(complex_img)
    else:
        print("Complex diagram failed to render.")

if __name__ == "__main__":
    main()
