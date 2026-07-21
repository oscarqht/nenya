import re

with open('src/popup/popup.css', 'r') as f:
    content = f.read()

# Make body take full viewport height and width when displayed in a side panel
# Also remove fixed max-width and let it fill.
side_panel_css = """
/* Adjust for side panel if needed */
@media (min-width: 421px) {
  body {
    width: 100%;
    max-width: 100%;
    height: 100vh;
  }
}
"""

content += "\n" + side_panel_css

with open('src/popup/popup.css', 'w') as f:
    f.write(content)
