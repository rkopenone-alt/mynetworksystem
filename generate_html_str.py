import os
import json

html_path = r"c:\Users\Alienware\Desktop\Rescue Backup 26-04-2026\preview-rescuer.html"
js_path = r"c:\Users\Alienware\Desktop\Rescue Backup 26-04-2026\rescuer-app\htmlStr.js"

with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Exact URL replacements for local IP
html_content = html_content.replace("'localhost'", "'192.168.1.5'")
html_content = html_content.replace("window.location.hostname", "'192.168.1.5'")

js_content = f"export const htmlString = {json.dumps(html_content)};\n"

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Successfully replaced URLs with 192.168.1.5!")
