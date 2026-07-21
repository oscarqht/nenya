import re

with open('src/popup/index.html', 'r') as f:
    content = f.read()

# Make the shortcuts wrap rather than overflow since side panel might be narrow, or to fill available space nicely
content = re.sub(
    r'<div class="flex-none gap-2" id="shortcutsContainer">',
    r'<div class="flex-none gap-2 flex-wrap" id="shortcutsContainer">',
    content
)

with open('src/popup/index.html', 'w') as f:
    f.write(content)
