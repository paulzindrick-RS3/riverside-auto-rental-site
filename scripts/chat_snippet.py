"""Riverside Rental Help: the Retell chat widget tag for every page.

The tag goes just before </head>, as Retell's widget docs require. It is
wrapped in markers so it can be found, replaced, or removed in one step.
The agent version is pinned so edits in the Retell dashboard do not reach
the site until a version is published and this number is changed.
"""
import re

START = "<!-- rar-retell-chat -->"
END = "<!-- /rar-retell-chat -->"

SNIPPET = """<!-- rar-retell-chat -->
<script
  id="retell-widget"
  src="https://dashboard.retellai.com/retell-widget-v2.js"
  data-public-key="public_key_da95ba4dc7db83fda9dc7"
  data-agent-id="agent_75575d6baed61e400b9d29a6a1"
  data-agent-version="0"
  data-title="Riverside Rental Help"
  data-bot-name="Riverside Rental Help"
  data-fab-text="Riverside Rental Help"
  data-color="#304B78"
  data-chat-font-size="large"
  data-show-ai-popup="false"
  defer
></script>
<!-- /rar-retell-chat -->
"""

BLOCK = re.compile(re.escape(START) + r".*?" + re.escape(END) + r"\n?", re.S)


def inject(html):
    """Add (or refresh) exactly one widget tag before </head>. Idempotent."""
    if START in html:
        return BLOCK.sub(SNIPPET, html, count=1)
    m = re.search(r"</head>", html, re.I)
    if not m:
        return html
    return html[: m.start()] + SNIPPET + html[m.start() :]
