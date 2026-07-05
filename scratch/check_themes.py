import os

def check_themes():
    for f in os.listdir('.'):
        if f.endswith('.html') or f.endswith('.css'):
            try:
                with open(f, 'r', encoding='utf-8') as file:
                    content = file.read()
                    print(f"File: {f}")
                    print(f"  'dark' count: {content.lower().count('dark')}")
                    print(f"  'theme' count: {content.lower().count('theme')}")
                    print(f"  'mode' count: {content.lower().count('mode')}")
                    print(f"  'color' count: {content.lower().count('color')}")
            except Exception as e:
                pass

if __name__ == '__main__':
    check_themes()
