#!/usr/bin/env python3
"""Publish .scheduled blog posts and wire them into blog/index.html,
sitemap.xml, and llms.txt. Run from repo root.

- Flips blog/<slug>.html.scheduled -> blog/<slug>.html when PUBLISH_DATE <= today,
  stripping all leading HEADER: lines.
- Inserts an article card at the top of blog/index.html and removes the
  matching Coming Soon teaser (matched by post <h1> == teaser <h4>, with a
  word-subset fallback).
- Adds a <url> entry to sitemap.xml (lastmod = publish date).
- Adds a line under "## Live Blog Posts" in llms.txt.
All wiring steps are idempotent (skipped if the slug is already present) and
non-fatal: a wiring failure prints ::warning:: but never blocks publishing.
Exits 0 always; writes published count to the file named in $COUNT_FILE.
"""
import glob, html, os, re, sys
from datetime import date, datetime

SITE = "https://riversideautorental.com"
today = os.environ.get("PUBLISH_TODAY") or date.today().isoformat()
published = []  # (slug, h1_raw, desc_raw, pub_date)

def warn(msg): print(f"::warning::{msg}")

def norm(s):
    return re.sub(r"\s+", " ", html.unescape(s)).strip().lower()

# ---------- 1. flip .scheduled files ----------
for sched in sorted(glob.glob("blog/*.scheduled")):
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
        warn(f"{sched}: no PUBLISH_DATE header, skipping"); continue
    if pub > today:
        print(f"{sched}: scheduled for {pub}, not yet"); continue
    real = sched[: -len(".scheduled")]
    body = "".join(lines[body_start:])
    with open(real, "w", encoding="utf-8", newline="") as f:
        f.write(body)
    os.remove(sched)
    slug = os.path.basename(real)
    m = re.search(r"<h1[^>]*>(.*?)</h1>", body, re.S)
    h1 = re.sub(r"\s+", " ", m.group(1)).strip() if m else slug
    m = re.search(r'property="og:description" content="([^"]*)"', body)
    desc = m.group(1) if m else ""
    if not desc:
        m = re.search(r'name="description" content="([^"]*)"', body)
        desc = m.group(1) if m else ""
    published.append((slug, h1, desc, pub))
    print(f"Published: {real} ({pub})")

# ---------- 2. wire each published post in ----------
def pretty_date(iso):
    d = datetime.strptime(iso, "%Y-%m-%d")
    return f"{d.strftime('%B')} {d.day}, {d.year}"

for slug, h1, desc, pub in published:
    url = f"{SITE}/blog/{slug}"
    datestr = pretty_date(pub)

    # --- blog/index.html ---
    try:
        p = "blog/index.html"
        s = open(p, encoding="utf-8").read()
        if f'href="{slug}"' in s:
            print(f"index: {slug} already carded")
        else:
            card_desc = desc
            teaser_re = re.compile(
                r'\n?[ \t]*<div style="padding:20px 24px;[^"]*">\s*'
                r"<h4[^>]*>(.*?)</h4>\s*<p[^>]*>(.*?)</p>\s*</div>", re.S)
            removed = False
            for m in teaser_re.finditer(s):
                t_title, t_desc = m.group(1), m.group(2)
                tn, hn = norm(t_title), norm(h1)
                if tn == hn or set(tn.replace(":", "").split()) <= set(hn.replace(":", "").split()):
                    card_desc = re.sub(r"\s+", " ", t_desc).strip()
                    s = s[: m.start()] + s[m.end():]
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

    # --- sitemap.xml ---
    try:
        p = "sitemap.xml"
        s = open(p, encoding="utf-8").read()
        if url in s:
            print(f"sitemap: {slug} already present")
        else:
            entry = ("  <url>\n"
                     f"    <loc>{url}</loc>\n"
                     f"    <lastmod>{pub}</lastmod>\n"
                     "    <changefreq>yearly</changefreq>\n"
                     "    <priority>0.6</priority>\n"
                     "  </url>\n")
            m = re.search(r"<url>\s*<loc>" + re.escape(SITE) + r"/blog/[^<]+\.html</loc>", s)
            if m:
                lstart = s.rfind("\n", 0, m.start()) + 1
            else:
                m2 = re.search(r"<loc>" + re.escape(SITE) + r"/blog/</loc>.*?</url>\s*\n", s, re.S)
                lstart = m2.end() if m2 else s.find("</urlset>")
            s = s[:lstart] + entry + s[lstart:]
            open(p, "w", encoding="utf-8").write(s)
            print(f"sitemap: entry added for {slug}")
    except Exception as e:
        warn(f"sitemap.xml update failed for {slug}: {e}")

    # --- llms.txt ---
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

count_file = os.environ.get("COUNT_FILE")
if count_file:
    with open(count_file, "w") as f:
        f.write(str(len(published)))
print(f"{len(published)} post(s) published.")
