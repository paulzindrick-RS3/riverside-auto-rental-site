#!/usr/bin/env python3
"""Add the chat widget snippet to every published HTML page. Idempotent."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_sitemap  # noqa: E402
import chat_widget_snippet  # noqa: E402


def main():
    changed = 0
    for path in sorted(build_sitemap.iter_html()):
        raw = open(path, "rb").read()
        text = raw.decode("utf-8")
        updated = chat_widget_snippet.inject(text)
        if updated == text:
            continue
        if b"\r\n" in raw:
            updated = updated.replace("\r\n", "\n").replace("\n", "\r\n")
        open(path, "wb").write(updated.encode("utf-8"))
        changed += 1
        print(f"injected {path}")
    print(f"chat widget snippet: {changed} page(s) updated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
