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

More rules in the same block polish the open chat:
- "Riverside Rental Help" next to the R in the chat header.
- A navy outline on the message box and a solid navy Send button (Retell's
  defaults were a faint gray outline and a half-faded button).
- Bigger navy "typing" dots in a light bubble while a reply is on its way
  (Retell's were three tiny gray dots with no bubble, easy to miss).
- A welcome note. Retell chats always wait for the visitor to speak first
  and show an empty first agent bubble; the rule writes the welcome text
  into that empty bubble (only while it is empty, only the first one).
- The open-chat collapse button: navy arrow on computers; hidden on phones,
  where it sat on top of the Send button (the header X closes the chat).
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
  data-agent-version="3"
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
        '[class*="_fabText_"]{color:#304B78!important;font-weight:700!important}' +
        '[class*="_fabOpen_"] path{stroke:#304B78!important}' +
        '[class*="_inputShell_"]{border:1.5px solid #304B78!important}' +
        '[class*="_sendButton_"]{opacity:1!important;background:#304B78!important;color:#fff!important}' +
        '[class*="_typingBubble_"]{display:inline-flex!important;align-items:center;background:#E8EDF4!important;border-radius:18px!important;padding:12px 16px!important;margin:4px 0 4px 14px!important;width:auto!important}' +
        '[class*="_dots_"]{display:inline-flex!important;gap:5px!important}' +
        '[class*="_dots_"]>span{width:9px!important;height:9px!important;background:#304B78!important;border-radius:50%!important}' +
        '@media (max-width:768px){[class*="_fabWrapChat_"]:has([class*="_fabOpen_"]){display:none!important}}' +
        '[class*="_headerBrand_"]::after{content:"Riverside Rental Help";font-weight:700;color:#304B78;margin-left:8px;font-size:16px;white-space:nowrap}' +
        '[class*="_messages_"]>[class*="_agentGroup_"]:first-child [class*="_agent_"]:empty{width:auto!important;max-width:85%}' +
        '[class*="_messages_"]>[class*="_agentGroup_"]:first-child [class*="_agent_"]:empty::before{display:block;white-space:normal;' +
        'content:"Hi! I’m Riverside’s automated assistant. I can quote rates, explain what you need to rent, or take a rental request for the team. What can I help with?"}';
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
