import os
import re

# Define paths
WORKSPACE_DIR = r"c:\Users\user\Downloads\Free_job\موقع تعليم"
TARGET_DIR = os.path.join(WORKSPACE_DIR, "apps", "web", "src")

# Define replacements mapping (keys will be compiled as case-insensitive regex)
REPLACEMENTS = {
    r"#07211b": "#0F3A40",      # Old Green -> New Dark Green
    r"#c09f7a": "#D4A353",      # Old Gold -> Rich Bronze Gold
    r"#ab8b66": "#B89754",      # Old Gold Hover -> Deeper Gold
    r"#143d33": "#1D535B",      # Old Dark Border -> Light Turquoise/Teal
    r"#0c2d25": "#1D535B",      # Old Dark Secondary -> Light Turquoise/Teal
    r"#8aa39c": "#E4CC9C",      # Old Muted Text -> Luxury Gold
    r"#fcf8f2": "#FFFFF0",      # Old Light Main -> Pure Ivory
    r"#f5ede4": "#FAEDCD",      # Old Light Secondary -> Rich Ivory/Beige
    r"#e5dcd3": "#FAEDCD",      # Old Border Color -> Rich Ivory/Beige
    r"rgba\(192,\s*159,\s*122,": "rgba(212, 163, 83,",
    r"rgba\(7,\s*33,\s*27,": "rgba(15, 58, 64,"
}

def migrate_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    modified = False

    for old, new in REPLACEMENTS.items():
        # Case insensitive replacement for hex codes
        pattern = re.compile(old, re.IGNORECASE)
        if pattern.search(content):
            content = pattern.sub(new, content)
            modified = True

    if modified:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Migrated: {file_path}")
        return True
    return False

def main():
    print(f"Scanning directory: {TARGET_DIR}")
    count = 0
    for root, dirs, files in os.walk(TARGET_DIR):
        # Skip node_modules and next build artifacts just in case
        if "node_modules" in root or ".next" in root:
            continue
        for file in files:
            if file.endswith(('.tsx', '.ts', '.css')):
                file_path = os.path.join(root, file)
                # Skip globals.css itself since we manually updated it to keep semantic var definitions
                if file == "globals.css":
                    continue
                if migrate_file(file_path):
                    count += 1
    print(f"Migration completed. Total files modified: {count}")

if __name__ == "__main__":
    main()
