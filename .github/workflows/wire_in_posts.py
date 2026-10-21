#!/usr/bin/env python3
"""Publish .scheduled blog posts and wire them into blog/index.html,
the homepage Latest guides block, sitemap.xml, and llms.txt. Run from repo root.

- Flips .scheduled/blog/<slug>.html.scheduled (or a leftover blog/<slug>.html.scheduled)
  to blog/<slug>.html when PUBLISH_DATE <= today, stripping leading HEADER: lines.
- The public date is the run date (today, or $PUBLISH_TODAY), not an earlier
  PUBLISH_DATE. datePublished and dateModified in the new HTML are set to that day.
- Inserts an article card at the top of blog/index.html and removes the
  matching Coming Soon teaser (matched by post <h1> == teaser <h4>, with a
  word-subset fallback).
- Refreshes the homepage Latest guides list from the first six blog cards.
- Regenerates sitemap.xml. The new post, /blog/, and the homepage get this
  run's date because their content changed. Every other URL keeps the
  lastmod check_site.py expects: that page's last git commit date. A
  depth-1 checkout makes the tip look like it added every file; a date
  that comes only from that shallow boundary is ignored and the existing
  lastmod is kept.
- Adds a line under "## Live Blog Posts" in llms.txt.
All wiring steps are idempotent (skipped if the slug is already present) and
non-fatal: a wiring failure prints ::warning:: but never blocks publishing.
Exits 0 always; writes published count to the file named in $COUNT_FILE.
"""
import glob
import html
import os
import re
import sys
from datetime import date, datetime

SITE = "https://riversideautorental.com"
TODAY = os.environ.get("PUBLISH_TODAY") or date.today().isoformat()
GUIDES_START = "<!-- LATEST_GUIDES:START -->"
GUIDES_END = "<!-- LATEST_GUIDES:END -->"


def warn(msg):
    print(f"::warning::{msg}")


def norm(s):
    return re.sub(r"\s+", " ", html.unescape(s)).strip().lower()


def pretty_date(iso):
    d = datetime.strptime(iso, "%Y-%m-%d")
    return f"{d.strftime('%B')} {d.day}, {d.year}"


def scheduled_sources():
    found = glob.glob(".scheduled/blog/*.html.scheduled") + glob.glob("blog/*.html.scheduled")
    return sorted(set(found))


def stamp_public_date(body, iso):
    body = re.sub(
        r'("datePublished"\s*:\s*")\d{4}-\d{2}-\d{2}(")',
        rf"\g<1>{iso}\2",
        body,
    )
    body = re.sub(
        r'("dateModified"\s*:\s*")\d{4}-\d{2}-\d{2}(")',
        rf"\g<1>{iso}\2",
        body,
    )
    return body


def latest_guide_items(index_html, n=6):
    items = []
    for art in re.findall(r"<article\b.*?</article>", index_html, re.S):
        hm = re.search(r'<h2[^>]*>\s*<a href="([^"]+)"[^>]*>(.*?)</a>', art, re.S)
        if not hm:
            continue
        href, title = hm.group(1).strip(), re.sub(r"\s+", " ", hm.group(2)).strip()
        if not href.startswith("/") and not href.startswith("http"):
            href = "/blog/" + href.lstrip("./")
        dm = re.search(r'<span class="section-label">(.*?)</span>', art, re.S)
        label = re.sub(r"\s+", " ", dm.group(1)).strip() if dm else ""
        items.append((href, title, label))
        if len(items) >= n:
            break
    return items


def render_latest_guides(items):
    lines = ['<ul style="max-width:720px;margin:0 auto;list-style:none;padding:0;">']
    for href, title, label in items:
        date_html = (
            f' <span style="color:var(--text-light);">&mdash; {label}</span>' if label else ""
        )
        lines.append(
            f'<li style="margin-bottom:16px;"><a href="{href}" '
            f'style="color:var(--navy);font-weight:600;text-decoration:underline;">{title}</a>'
            f"{date_html}</li>"
        )
    lines.append("</ul>")
    return "\n".join(lines)


def refresh_latest_guides():
    index = open("blog/index.html", encoding="utf-8").read()
    items = latest_guide_items(index)
    if len(items) < 1:
        warn("homepage: no blog cards found for Latest guides")
        return
    path = "index.html"
    page = open(path, encoding="utf-8").read()
    if GUIDES_START not in page or GUIDES_END not in page:
        warn("homepage: Latest guides markers missing; block NOT updated")
        return
    block = GUIDES_START + "\n" + render_latest_guides(items) + "\n" + GUIDES_END
    updated = re.sub(
        re.escape(GUIDES_START) + r".*?" + re.escape(GUIDES_END),
        lambda _m: block,
        page,
        count=1,
        flags=re.S,
    )
    if updated != page:
        open(path, "w", encoding="utf-8", newline="\n").write(updated)
        print(f"homepage: Latest guides refreshed ({len(items)} posts)")
    else:
        print("homepage: Latest guides already current")


def rebuild_sitemap():
    sys.path.insert(0, os.path.join(os.getcwd(), "scripts"))
    import build_sitemap

    build_sitemap.main()


def main():
    published = []  # (slug, h1_raw, desc_raw, public_date)

    for sched in scheduled_sources():
        with open(sched, encoding="utf-8", newline="") as f:
            raw = f.read()
        lines = raw.splitlines(keepends=True)
        headers, body_start = {}, 0
        for i, line in enumerate(lines[:5]):
            m = re.match(r"^([A-Z_]+):\s*(.*?)\r?\n?$", line)
            if m:
                headers[m.group(1)] = m.group(2).strip()
                body_start = i + 1
            else:
                break
        pub = headers.get("PUBLISH_DATE")
        if not pub:
            warn(f"{sched}: no PUBLISH_DATE header, skipping")
            continue
        if pub > TODAY:
            print(f"{sched}: scheduled for {pub}, not yet")
            continue
        slug = os.path.basename(sched)[: -len(".scheduled")]
        real = os.path.join("blog", slug)
        # Public date is the day it goes live, never an earlier header date.
        public = TODAY
        body = stamp_public_date("".join(lines[body_start:]), public)
        with open(real, "w", encoding="utf-8", newline="") as f:
            f.write(body)
        os.remove(sched)
        m = re.search(r"<h1[^>]*>(.*?)</h1>", body, re.S)
        h1 = re.sub(r"\s+", " ", m.group(1)).strip() if m else slug
        m = re.search(r'property="og:description" content="([^"]*)"', body)
        desc = m.group(1) if m else ""
        if not desc:
            m = re.search(r'name="description" content="([^"]*)"', body)
            desc = m.group(1) if m else ""
        published.append((slug, h1, desc, public))
        print(f"Published: {real} (live {public}; header {pub})")

    for slug, h1, desc, pub in published:
        url = f"{SITE}/blog/{slug}"
        datestr = pretty_date(pub)

        try:
            p = "blog/index.html"
            s = open(p, encoding="utf-8").read()
            if f'href="{slug}"' in s:
                print(f"index: {slug} already carded")
            else:
                card_desc = desc
                teaser_re = re.compile(
                    r'\n?[ \t]*<div style="padding:20px 24px;[^"]*">\s*'
                    r"<h4[^>]*>(.*?)</h4>\s*<p[^>]*>(.*?)</p>\s*</div>",
                    re.S,
                )
                removed = False
                for m in teaser_re.finditer(s):
                    t_title, t_desc = m.group(1), m.group(2)
                    tn, hn = norm(t_title), norm(h1)
                    if tn == hn or set(tn.replace(":", "").split()) <= set(
                        hn.replace(":", "").split()
                    ):
                        card_desc = re.sub(r"\s+", " ", t_desc).strip()
                        s = s[: m.start()] + s[m.end() :]
                        removed = True
                        print(f"index: removed Coming Soon teaser '{t_title.strip()}'")
                        break
                if not removed:
                    warn(f"index: no Coming Soon teaser matched '{h1}' — card added anyway")
                card = (
                    '        <article style="margin-bottom:48px;padding-bottom:40px;'
                    'border-bottom:1px solid var(--light-gray);">\n'
                    f'          <span class="section-label">{datestr}</span>\n'
                    f'          <h2 style="margin-bottom:12px;"><a href="{slug}" '
                    f'style="color:var(--charcoal);text-decoration:none;">{h1}</a></h2>\n'
                    f'          <p style="color:var(--text-light);margin-bottom:16px;">{card_desc}</p>\n'
                    f'          <a href="{slug}" class="btn btn--outline" '
                    'style="padding:10px 20px;font-size:0.85rem;">Read Article &rarr;</a>\n'
                    "        </article>\n"
                )
                i = s.find("<article")
                if i == -1:
                    warn("index: no <article> found; card NOT added")
                else:
                    lstart = s.rfind("\n", 0, i) + 1
                    s = s[:lstart] + card + s[lstart:]
                    open(p, "w", encoding="utf-8").write(s)
                    print(f"index: card added for {slug}")
        except Exception as e:
            warn(f"index.html update failed for {slug}: {e}")

        try:
            p = "llms.txt"
            s = open(p, encoding="utf-8").read()
            if url in s:
                print(f"llms: {slug} already present")
            else:
                marker = "## Live Blog Posts\n\n"
                i = s.find(marker)
                if i == -1:
                    warn("llms: '## Live Blog Posts' section not found; NOT updated")
                else:
                    line = f"- {url} — {html.unescape(h1)} ({datestr})\n"
                    j = i + len(marker)
                    s = s[:j] + line + s[j:]
                    open(p, "w", encoding="utf-8").write(s)
                    print(f"llms: entry added for {slug}")
        except Exception as e:
            warn(f"llms.txt update failed for {slug}: {e}")

    if published:
        try:
            refresh_latest_guides()
        except Exception as e:
            warn(f"homepage Latest guides update failed: {e}")
        try:
            rebuild_sitemap()
        except Exception as e:
            warn(f"sitemap.xml rebuild failed: {e}")

    count_file = os.environ.get("COUNT_FILE")
    if count_file:
        with open(count_file, "w") as f:
            f.write(str(len(published)))
    print(f"{len(published)} post(s) published.")


if __name__ == "__main__":
    main()
