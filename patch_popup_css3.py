import re

with open('src/popup/popup.css', 'r') as f:
    content = f.read()

# Replace the specific body block
new_body = """body {
  width: 100vw;
  height: 100vh;
  min-height: 300px;
  /* Instead of locking the width, allow the popup window container to dictate the width.
     In chrome side panels, width expands automatically up to the max side panel width.
     For popups, Chrome will size the window to the content up to 800px.
     So we can use min-width to prevent the side panel from squishing it too much.
  */
  min-width: var(--popup-width);
  overflow-x: hidden;
}"""

content = re.sub(
    r'body \{\n\s*width: 100vw;\n\s*height: 100vh;\n\s*min-height: 300px;\n\s*/\* Instead of locking the width.*?\*/\n\s*min-width: var\(--popup-width\);\n\s*overflow-x: hidden;\n\}',
    """body {
  width: 100vw;
  height: 100vh;
  min-height: 300px;
  min-width: 100%; /* fill space */
  overflow-x: hidden;
}""",
    content,
    flags=re.DOTALL
)

with open('src/popup/popup.css', 'w') as f:
    f.write(content)
