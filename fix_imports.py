import os
import re

def fix_imports_in_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Match import/export statements that use relative paths not ending in .js
    # e.g. import { foo } from "./bar"
    # e.g. export * from "../baz"
    pattern = r'((?:import|export).*?from\s+["\'](\.|/)[^"\']+)((?<!\.js)["\'])'
    
    new_content = re.sub(pattern, r'\1.js\3', content)

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Fixed {filepath}")

def main():
    src_dir = '/home/ubuntu/atrail/apps/api/src'
    for root, _, files in os.walk(src_dir):
        for file in files:
            if file.endswith('.ts') and not file.endswith('.d.ts'):
                fix_imports_in_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
