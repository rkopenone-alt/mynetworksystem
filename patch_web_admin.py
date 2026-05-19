import os

html_path = r"c:\Users\Alienware\Desktop\Rescue Backup 26-04-2026\preview-web-admin.html"

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure all window.location.hostname have a fallback to localhost
content = content.replace("window.location.hostname || 'localhost'", "window.location.hostname || 'localhost'")
content = content.replace("${window.location.hostname}:3001", "${window.location.hostname || 'localhost'}:3001")

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Web Admin file patched.")
