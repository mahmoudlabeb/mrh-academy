import glob
import re
import os

html_files = glob.glob('*.html')
all_files = set(os.listdir('.'))

print("--- Checking Links ---")
for f in html_files:
    content = open(f, encoding='utf-8').read()
    links = re.findall(r'href=[\'"]([^\'"]+\.html[^\'"]*)[\'"]', content)
    for link in links:
        base = link.split('?')[0].split('#')[0]
        if base not in all_files:
            print(f"{f}: Broken internal link -> {link}")

print("\n--- Checking Assets ---")
for f in html_files:
    content = open(f, encoding='utf-8').read()
    srcs = re.findall(r'src=[\'"]([^\'"]+)[\'"]', content)
    for src in srcs:
        if not src.startswith('http'):
            base = src.split('?')[0]
            if base not in all_files and not os.path.exists(base):
                print(f"{f}: Missing asset -> {src}")

print("\n--- Checking Forms and Actions ---")
for f in html_files:
    content = open(f, encoding='utf-8').read()
    actions = re.findall(r'action=[\'"]([^\'"]+)[\'"]', content)
    for action in actions:
        if action.endswith('.html') and action not in all_files:
            print(f"{f}: Broken form action -> {action}")

