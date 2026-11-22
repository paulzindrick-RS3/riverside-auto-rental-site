"""Riverside Rental Help: the Retell chat widget tag for every page.

The tag goes just before </head>, as Retell's widget docs require. It is
wrapped in markers so it can be found, replaced, or removed in one step.
The agent version is pinned so edits in the Retell dashboard do not reach
the site until a version is published and this number is changed.

On phones (768px and narrower) the site shows a fixed red "Call" banner at
the bottom of the screen. Retell's widget has no setting for its position
and draws its button inside its own shadow root, so a small script adds one
style rule there that lifts the button (and the open chat) 76px above the
banner on those screens. The same rule block turns the button white with
navy text and border, so it stands out against the navy hero and red
banner. If Retell renames its classes, the rules simply stop matching and
the button goes back to Retell's default look in the corner - nothing breaks.

The button and chat header use the Riverside "R" (images/chat-icon.png)
instead of Retell's default gradient orb and logo.
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
  data-agent-version="1"
  data-title="Riverside Rental Help"
  data-bot-name="Riverside Rental Help"
  data-fab-text="Rental Help"
  data-fab-icon-url="https://riversideautorental.com/images/chat-icon.png"
  data-logo-url="https://riversideautorental.com/images/chat-icon.png"
  data-color="#304B78"
  data-chat-font-size="large"
  data-show-ai-popup="false"
  defer
></script>
<script>
(function () {
  var tries = 0;
  var timer = setInterval(function () {
    var root = document.getElementById("retell-widget-root");
    var host = root && root.firstElementChild;
    var shadow = host && host.shadowRoot;
    if (shadow && !shadow.getElementById("rar-lift")) {
      var style = document.createElement("style");
      style.id = "rar-lift";
      style.textContent =
        '@media (max-width:768px){[class*="_container_"]{bottom:76px!important}}' +
        '[class*="_fabChat_"]{background:#fff!important;border:2px solid #304B78!important;box-shadow:0 4px 14px rgba(0,0,0,.25)!important}' +
        '[class*="_fabText_"]{color:#304B78!important;font-weight:700!important}';
      shadow.appendChild(style);
    }
    if (shadow || ++tries > 80) clearInterval(timer);
  }, 250);
})();
</script>
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
