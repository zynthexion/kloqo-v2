import os
import re

count = 0
for root, _, files in os.walk('./apps'):
    if 'node_modules' in root or '.next' in root:
        continue
    for f in files:
        if not (f.endswith('.ts') or f.endswith('.tsx')): continue
        path = os.path.join(root, f)
        with open(path, 'r') as file:
            content = file.read()
            
        pattern = r"from\s+['\"]([^'\"]*lib/types|[^'\"]*types)['\"]"
        if re.search(pattern, content):
            new_content = re.sub(pattern, r"from '@kloqo/shared'", content)
            if new_content != content:
                with open(path, 'w') as file:
                    file.write(new_content)
                print(f"Updated {path}")
                count += 1

print(f"Total files updated: {count}")
