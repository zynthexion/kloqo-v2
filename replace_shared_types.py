import os
import re

count = 0
dirs_to_check = ['./apps', './backend', '../packages']

for check_dir in dirs_to_check:
    for root, _, files in os.walk(check_dir):
        if 'node_modules' in root or '.next' in root:
            continue
        for f in files:
            if not (f.endswith('.ts') or f.endswith('.tsx') or f.endswith('.json')): continue
            path = os.path.join(root, f)
            with open(path, 'r') as file:
                try:
                    content = file.read()
                except UnicodeDecodeError:
                    continue
                
            # Replace @kloqo/shared-types with @kloqo/shared
            if '@kloqo/shared-types' in content:
                new_content = content.replace('@kloqo/shared-types', '@kloqo/shared')
                if new_content != content:
                    with open(path, 'w') as file:
                        file.write(new_content)
                    print(f"Updated {path}")
                    count += 1

print(f"Total files updated: {count}")
