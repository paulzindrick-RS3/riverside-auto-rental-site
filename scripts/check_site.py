#!/usr/bin/env python3
"""Lightweight repo checks for sitemap, canonicals, and llms.txt.

- Every sitemap URL exists as a file.
- That file has exactly one rel=canonical, equal to the sitemap URL.
- llms.txt and the sitemap list the same riversideautorental.com URLs.
- Sitemap lastmod matches git (or today, when the file is dirty).
- blog/ has no scheduled drafts and no extensionless files.
"""
import os
import re
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_sitemap  # noqa: E402

SITE = "https://riversideautorental.com"
NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
errors = []


def expected_loc(path):
    rel = path.replace("\\", "/").lstrip("./")
    special = {
        "index.html": f"{SITE}/",
        "fleet.html": f"{SITE}/fleet",
        "rent-local.html": f"{SITE}/rent-local",
        "blog/index.html": f"{SITE}/blog/",
        "locations/index.html": f"{SITE}/locations/",
    }
    if rel in special:
        return special[rel]
    return f"{SITE}/{rel}"


def file_for_loc(loc):
    if not loc.startswith(SITE):
        return None
    path = loc[len(SITE):]
    if path in ("", "/"):
        return "index.html"
    if path == "/fleet":
        return "fleet.html"
    if path == "/rent-local":
        return "rent-local.html"
    if path == "/blog/":
        return "blog/index.html"
    if path == "/locations/":
        return "locations/index.html"
    return path.lstrip("/")


def norm_site_url(url):
    url = url.rstrip(".,")
    if url.rstrip("/") == SITE:
        return f"{SITE}/"
    return url


def main():
    tree = ET.parse("sitemap.xml")
    urls = []
    for node in tree.getroot().findall("sm:url", NS):
        loc = node.find("sm:loc", NS).text.strip()
        lastmod = node.find("sm:lastmod", NS)
        urls.append((loc, lastmod.text.strip() if lastmod is not None else ""))

    locs = [loc for loc, _ in urls]
    if len(locs) != len(set(locs)):
        errors.append("sitemap has duplicate <loc> values")

    seen_files = set()
    for loc, lastmod in urls:
        path = file_for_loc(loc)
        if not path or not os.path.isfile(path):
            errors.append(f"sitemap URL has no file: {loc}")
            continue
        seen_files.add(os.path.normpath(path))
        text = open(path, encoding="utf-8").read()
        cans = build_sitemap.canonicals(text)
        if len(cans) != 1:
            errors.append(f"{path}: expected 1 canonical, found {len(cans)}")
        elif cans[0] != loc:
            errors.append(f"{path}: canonical {cans[0]} != sitemap {loc}")
        elif expected_loc(path) != loc:
            errors.append(f"{path}: file maps to {expected_loc(path)}, sitemap has {loc}")
        expected_lastmod = build_sitemap.git_lastmod(path)
        if lastmod != expected_lastmod:
            errors.append(f"{path}: lastmod {lastmod} != git/file date {expected_lastmod}")

    for path in build_sitemap.iter_html():
        if os.path.normpath(path) in seen_files:
            continue
        errors.append(f"HTML page missing from sitemap: {path}")

    llms = open("llms.txt", encoding="utf-8").read()
    llms_urls = []
    for raw in re.findall(r"https://riversideautorental\.com[^\s)\"'<>]*", llms):
        llms_urls.append(norm_site_url(raw))
    llms_set = set(llms_urls)
    loc_set = set(locs)
    for loc in locs:
        if loc not in llms_set:
            errors.append(f"sitemap URL missing from llms.txt: {loc}")
    for url in sorted(llms_set):
        if url not in loc_set:
            errors.append(f"llms.txt URL missing from sitemap: {url}")

    if os.path.isdir("blog"):
        for name in os.listdir("blog"):
            path = os.path.join("blog", name)
            if not os.path.isfile(path):
                continue
            if not name.endswith(".html") or name.endswith(".scheduled") or ".scheduled" in name:
                errors.append(f"blog/ is public and contains a non-page file: {path}")

    if errors:
        print(f"{len(errors)} site check(s) failed:")
        for err in errors:
            print(f"  - {err}")
        return 1
    print(f"site checks passed ({len(locs)} sitemap URL(s), llms.txt in sync)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
