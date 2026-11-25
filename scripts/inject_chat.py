#!/usr/bin/env python3
"""Add the Riverside Rental Help chat tag to every published HTML page. Idempotent."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_sitemap  # noqa: E402
import chat_snippet  # noqa: E402


def main():
    changed = 0
    for path in sorted(build_sitemap.iter_html()):
        raw = open(path, "rb").read()
        text = raw.decode("utf-8")
        crlf = b"\r\n" in raw
        norm = text.replace("\r\n", "\n")
        updated = chat_snippet.inject(norm)
        if updated == norm:
            continue
        if crlf:
            updated = updated.replace("\n", "\r\n")
        open(path, "wb").write(updated.encode("utf-8"))
        changed += 1
    print(f"chat tag: {changed} page(s) updated")
    return 0


if __name__ == "__main__":
    sys.exit(main())
