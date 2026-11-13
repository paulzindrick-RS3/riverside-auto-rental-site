#!/usr/bin/env python3
"""The Help control is a real sms: link even when chat and JavaScript are off."""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_sitemap  # noqa: E402

SMS = "sms:+17153961466"
HELP_LINK = re.compile(
    r'<a\b[^>]*\bid=["\']rar-help["\'][^>]*>',
    re.I,
)


def expect(cond, message, failures):
    print(("PASS " if cond else "FAIL ") + message)
    if not cond:
        failures.append(message)


def main():
    failures = []
    widget = open("js/chat-widget.js", encoding="utf-8").read()
    css = open("css/chat-widget.css", encoding="utf-8").read()
    expect("mode === \"chat\"" in widget, "menu is added only when status says chat", failures)
    expect("STATUS_TIMEOUT_MS" in widget and "abort()" in widget, "a slow status check gives up and leaves texting", failures)
    expect("sms:+17153961466" in widget and "sms:" in widget and "?body=" not in widget and "&body=" not in widget, "script uses the bubble sms link with no prefill", failures)
    expect(not re.search(r"\bAI\b", widget), "chat script does not say AI", failures)
    expect("automated assistant" in widget and "Riverside Rental Help" in widget, "chat keeps its name and automated-assistant disclosure", failures)
    expect('href = "/privacy.html"' in widget or 'href="/privacy.html"' in widget, "disclosure links to the privacy page", failures)
    expect(re.search(r'el\("a"[^)]*"Privacy"\)', widget), "privacy link is a real anchor", failures)
    expect(not re.search(r"\bAI\b", css), "chat css does not say AI", failures)
    expect("bottom: 72px" in css, "mobile offset stays above the call bar", failures)
    expect("chat-handoff" not in widget, "widget does not post a handoff form", failures)

    pages = list(build_sitemap.iter_html())
    expect(len(pages) > 40, "published pages were scanned", failures)
    for path in pages:
        text = open(path, encoding="utf-8").read()
        expect(len(HELP_LINK.findall(text)) == 1, f"{path}: one Help link", failures)
        tag = HELP_LINK.search(text)
        expect(tag and f'href="{SMS}"' in tag.group(0), f"{path}: Help link is the unprefilled sms link", failures)
        expect("sms:+17153961466?" not in text and "sms:+17153961466&" not in text, f"{path}: no sms prefill", failures)
        expect('id="sms-bubble"' not in text and "id='sms-bubble'" not in text, f"{path}: old Text Us bubble is gone", failures)
        expect("chat-handoff" not in text, f"{path}: no callback form", failures)
        visible = re.sub(r"(?is)<script\b[^>]*>.*?</script>", " ", text)
        visible = re.sub(r"(?is)<style\b[^>]*>.*?</style>", " ", visible)
        expect(not re.search(r"\bAI\b", visible), f"{path}: visible page does not say AI", failures)

    if failures:
        print(f"\n{len(failures)} help-button check(s) failed")
        return 1
    print(f"\nhelp-button checks passed ({len(pages)} pages)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
