#!/usr/bin/env python3
"""Regenerate sitemap.xml from on-disk HTML.

lastmod is the file's last git commit date. A dirty or untracked file uses
today (or $PUBLISH_TODAY), so a publish that edits the homepage and /blog/
records that run's date before the commit. changefreq and priority are kept
from the current sitemap when the URL already exists.
"""
import os
import re
import subprocess
from datetime import date

SITE = "https://riversideautorental.com"
SKIP_DIRS = {".git", ".github", ".scheduled", "node_modules"}

PINNED = [
    f"{SITE}/",
    f"{SITE}/fleet",
    f"{SITE}/suv-rental.html",
    f"{SITE}/van-rental.html",
    f"{SITE}/insurance-replacement-rental.html",
    f"{SITE}/rent-local",
    f"{SITE}/contact.html",
    f"{SITE}/blog/",
]
LOCATIONS = [
    f"{SITE}/locations/",
    f"{SITE}/locations/tomah.html",
    f"{SITE}/locations/sparta.html",
    f"{SITE}/locations/neillsville.html",
    f"{SITE}/locations/warrens.html",
    f"{SITE}/locations/melrose.html",
    f"{SITE}/locations/osseo.html",
]


def today_iso():
    return os.environ.get("PUBLISH_TODAY") or date.today().isoformat()


def canonicals(text):
    found = []
    for tag in re.findall(r"<link\b[^>]*>", text, re.I):
        if re.search(r"\brel=[\"']canonical[\"']", tag, re.I):
            href = re.search(r"\bhref=[\"']([^\"']+)[\"']", tag, re.I)
            if href:
                found.append(href.group(1).strip())
    return found


def iter_html():
    for root, dirs, files in os.walk("."):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for name in files:
            if name.endswith(".html"):
                yield os.path.normpath(os.path.join(root, name))


def git_lastmod(path):
    status = subprocess.check_output(
        ["git", "status", "--porcelain", "--", path], text=True
    )
    if status.strip():
        return today_iso()
    log = subprocess.check_output(
        ["git", "log", "-1", "--format=%cs", "--", path], text=True
    ).strip()
    if log:
        return log
    return date.fromtimestamp(os.path.getmtime(path)).isoformat()


def load_meta(path="sitemap.xml"):
    meta = {}
    if not os.path.exists(path):
        return meta
    text = open(path, encoding="utf-8").read()
    for block in re.findall(r"<url>(.*?)</url>", text, re.S):
        loc = re.search(r"<loc>(.*?)</loc>", block)
        if not loc:
            continue
        cf = re.search(r"<changefreq>(.*?)</changefreq>", block)
        pr = re.search(r"<priority>(.*?)</priority>", block)
        meta[loc.group(1).strip()] = (
            cf.group(1).strip() if cf else None,
            pr.group(1).strip() if pr else None,
        )
    return meta


def defaults_for(loc):
    if "/blog/" in loc and loc.endswith(".html"):
        return "yearly", "0.6"
    return "monthly", "0.7"


def collect():
    pages = []
    for path in iter_html():
        text = open(path, encoding="utf-8").read()
        cans = canonicals(text)
        if len(cans) != 1 or not cans[0].startswith(SITE):
            continue
        published = re.search(r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"', text)
        pages.append(
            {
                "path": path,
                "loc": cans[0],
                "lastmod": git_lastmod(path),
                "published": published.group(1) if published else "",
            }
        )
    return pages


def sort_pages(pages):
    by_loc = {p["loc"]: p for p in pages}
    ordered = []
    seen = set()

    def take(loc):
        if loc in by_loc and loc not in seen:
            ordered.append(by_loc[loc])
            seen.add(loc)

    for loc in PINNED:
        if loc == f"{SITE}/blog/":
            take(loc)
            posts = [
                p
                for p in pages
                if p["loc"].startswith(f"{SITE}/blog/") and p["loc"].endswith(".html")
            ]
            posts.sort(key=lambda p: (p["published"], p["loc"]), reverse=True)
            # date desc, and for a shared date a stable loc order (reverse loc
            # would scramble ties). Re-sort ties ascending.
            posts.sort(key=lambda p: p["loc"])
            posts.sort(key=lambda p: p["published"], reverse=True)
            for post in posts:
                take(post["loc"])
        else:
            take(loc)
    extras = [p for p in pages if p["loc"] not in seen and p["loc"] not in LOCATIONS]
    for p in sorted(extras, key=lambda p: p["loc"]):
        take(p["loc"])
    for loc in LOCATIONS:
        take(loc)
    for p in sorted(pages, key=lambda p: p["loc"]):
        take(p["loc"])
    return ordered


def render(pages, meta):
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for page in pages:
        cf, pr = meta.get(page["loc"], (None, None))
        if not cf or not pr:
            cf, pr = defaults_for(page["loc"])
        lines.append("  <url>")
        lines.append(f"    <loc>{page['loc']}</loc>")
        lines.append(f"    <lastmod>{page['lastmod']}</lastmod>")
        lines.append(f"    <changefreq>{cf}</changefreq>")
        lines.append(f"    <priority>{pr}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    lines.append("")
    return "\n".join(lines)


def main():
    pages = sort_pages(collect())
    xml = render(pages, load_meta())
    with open("sitemap.xml", "w", encoding="utf-8", newline="\n") as f:
        f.write(xml)
    print(f"sitemap.xml: {len(pages)} URL(s)")


if __name__ == "__main__":
    main()
