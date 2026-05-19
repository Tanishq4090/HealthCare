import base64
import urllib.request
import sys

def main():
    mmd_path = "/Users/tanishqkachiwala/Downloads/Design/healthcare/scratch/sequence_flow.mmd"
    png_path = "/Users/tanishqkachiwala/Downloads/Design/healthcare/report/sequence_flow.png"
    
    print(f"Reading Mermaid sequence diagram from: {mmd_path}")
    with open(mmd_path, "r", encoding="utf-8") as f:
        code = f.read().strip()
        
    code_bytes = code.encode("utf-8")
    b64_encoded = base64.b64encode(code_bytes).decode("utf-8")
    b64_encoded = b64_encoded.replace("+", "-").replace("/", "_")
    
    url = f"https://mermaid.ink/img/{b64_encoded}"
    print(f"Fetching from URL: {url[:100]}...")
    
    try:
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req) as response:
            image_data = response.read()
            
        print(f"Saving PNG sequence flow to: {png_path}")
        with open(png_path, "wb") as f:
            f.write(image_data)
        print("Sequence diagram compiled and saved successfully!")
    except Exception as e:
        print(f"Error rendering sequence diagram: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
