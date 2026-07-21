import re
with open("src/popup/popup.css", "r") as f:
    text = f.read()

text = re.sub(
r'''body \{
  width: var\(--popup-width\);
  max-width: var\(--popup-width\);
  min-height: 300px;
\}''',
r'''body {
  width: 100vw;
  height: 100vh;
  min-height: 300px;
  min-width: var(--popup-width);
}''',
text)

with open("src/popup/popup.css", "w") as f:
    f.write(text)
