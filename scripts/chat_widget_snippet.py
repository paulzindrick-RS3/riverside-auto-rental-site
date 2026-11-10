"""Hidden Netlify Form plus the chat widget tags inserted before </body>.

The form is what Netlify detects at deploy time. The widget script decides
whether to draw anything. With CHAT_ENABLED off, visitors see no launcher.
"""
import re

MARKER = "<!-- rar-chat-widget -->"

SNIPPET = """<!-- rar-chat-widget -->
<link rel="stylesheet" href="/css/chat-widget.css">
<form name="chat-handoff" method="POST" action="/" data-netlify="true" netlify netlify-honeypot="bot-field" hidden aria-hidden="true">
  <input type="hidden" name="form-name" value="chat-handoff">
  <p hidden>
    <label>Leave this field empty <input name="bot-field" tabindex="-1" autocomplete="off"></label>
  </p>
  <input name="name" autocomplete="name">
  <input name="phone" autocomplete="tel">
  <input name="email" autocomplete="email">
  <input name="preferred_time" autocomplete="off">
  <textarea name="question"></textarea>
  <textarea name="transcript"></textarea>
  <input name="page_url">
</form>
<script src="/js/chat-widget.js" defer></script>
<!-- /rar-chat-widget -->
"""


def inject(html):
    """Insert the snippet once, immediately before the last </body>."""
    if MARKER in html:
        return html
    block = "\n" + SNIPPET
    match = None
    for match in re.finditer(r"</body>", html, re.I):
        pass
    if match is None:
        return html + block
    return html[: match.start()] + block + html[match.start() :]
