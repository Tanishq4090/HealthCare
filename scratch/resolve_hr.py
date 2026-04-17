with open("src/admin/HR.tsx", "r") as f:
    content = f.read()

import re
# The conflict in HR.tsx starts with <<<<<<< HEAD and ends with >>>>>>> 1e5bbcc
# My branch deleted the blocks, HEAD had the blocks.
# We want to entirely delete the conflict block (since we want the tabs gone)
new_content = re.sub(r'<<<<<<< HEAD.*?=======\n\n>>>>>>> [a-f0-9]+.*?\n', '', content, flags=re.DOTALL)
with open("src/admin/HR.tsx", "w") as f:
    f.write(new_content)
