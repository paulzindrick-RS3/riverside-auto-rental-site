"""One Help control for every page.

Without JavaScript, or when chat is off, it is a plain sms: link to
715-396-1466, the same link the Text Us bubble used, with no message
prefill. The script may turn that link into a menu only after
/api/chat-status says chat is available.
"""
import re

MARKER = "<!-- rar-chat-widget -->"

SNIPPET = """<!-- rar-chat-widget -->
<link rel="stylesheet" href="/css/chat-widget.css">
<a id="rar-help" class="rar-help" href="sms:+17153961466" aria-label="Text Riverside Auto Rental at 715-396-1466">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" aria-hidden="true" focusable="false"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
  Help
</a>
<script src="/js/chat-widget.js" defer></script>
<!-- /rar-chat-widget -->
"""

BUBBLE_COMMENT = re.compile(r"<!-- ========== TEXT US BUBBLE ========== -->\s*")
BUBBLE_STYLE = re.compile(r"<style>\s*#sms-bubble\{.*?</style>\s*", re.I | re.S)
BUBBLE_DIV = re.compile(
    r"<div\b[^>]*\bid=[\"']sms-bubble[\"'][^>]*>.*?</div>\s*",
    re.I | re.S,
)
WIDGET = re.compile(r"<!-- rar-chat-widget -->.*?<!-- /rar-chat-widget -->\s*", re.I | re.S)


def install(html):
    """Leave exactly one Help sms: link, and drop the old corner Text Us bubble."""
    html = BUBBLE_COMMENT.sub("", html)
    html = BUBBLE_STYLE.sub("", html)
    html = BUBBLE_DIV.sub("", html)
    html = WIDGET.sub("", html)
    if MARKER in html:
        return html
    block = "\n" + SNIPPET
    match = None
    for match in re.finditer(r"</body>", html, re.I):
        pass
    if match is None:
        return html + block
    return html[: match.start()] + block + html[match.start() :]


def inject(html):
    return install(html)
