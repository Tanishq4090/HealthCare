import re

def check_jsx_balance(file_path):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    div_stack = 0
    
    for i, line in enumerate(lines):
        line_num = i + 1
        opens = len(re.findall(r'<div(?:\s|>)', line))
        closes = len(re.findall(r'</div', line))
        
        # Self-closing divs are handled correctly by this because opens match closing tag? No.
        # Self closing divs in React: <div />. Let's account for that.
        self_closes = len(re.findall(r'<div[^>]*/>', line))
        
        div_stack += (opens - closes - self_closes)
        
        print(f"{line_num}: {div_stack}")

check_jsx_balance('/Users/tanishqkachiwala/Downloads/Design/healthcare/src/admin/CRM.tsx')
