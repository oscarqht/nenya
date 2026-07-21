import re

with open('src/popup/popup.css', 'r') as f:
    content = f.read()

content = re.sub(
    r'body \{\n  width: 100vw;\n  height: 100vh;\n  min-height: 300px;\n  min-width: var\(--popup-width\);\n  overflow-x: hidden;\n\}',
    r"""body {
  width: 100%;
  height: 100vh;
  min-height: 300px;
  min-width: var(--popup-width);
}

@media (min-width: 421px) {
  body {
    min-width: 100%;
  }
}
""",
    content
)

with open('src/popup/popup.css', 'w') as f:
    f.write(content)
