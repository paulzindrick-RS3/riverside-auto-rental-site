#!/usr/bin/env python3
"""Prove a scheduled publish dates the new post and leaves other lastmods put.

Replays the 055eb40 failure mode. A depth-1 clone of a tip commit that did
not edit the existing pages still makes git log date those pages to the tip,
because the hidden parent makes every file look newly added. The publish
must keep their sitemap lastmod anyway. A full-history run keeps them
because that lastmod is already the page's git commit date. The new post's
datePublished and lastmod are the run date (PUBLISH_TODAY).

Run from the repo root: python3 scripts/test_publish_lastmod.py
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLISH_TODAY = "2026-10-20"
SITE = "https://riversideautorental.com"


def git(repo, *args, when=None, check=True):
    cmd = [
        "git",
        "-C",
        str(repo),
        "-c",
        "user.email=test@example.com",
        "-c",
        "user.name=Test",
        *args,
    ]
    env = os.environ.copy()
    env["GIT_CONFIG_NOSYSTEM"] = "1"
    if when:
        env["GIT_AUTHOR_DATE"] = when
        env["GIT_COMMITTER_DATE"] = when
    proc = subprocess.run(cmd, env=env, text=True, capture_output=True)
    if check and proc.returncode != 0:
        raise SystemExit(
            f"git {' '.join(args)} failed:\n{proc.stdout}\n{proc.stderr}"
        )
    return proc


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def html_page(canonical, body, published=None):
    ld = ""
    if published:
        ld = (
            '<script type="application/ld+json">'
            f'{{"datePublished":"{published}","dateModified":"{published}"}}'
            "</script>\n"
        )
    return (
        "<!DOCTYPE html>\n<html><head>\n"
        f'<link rel="canonical" href="{canonical}">\n'
        '<meta property="og:description" content="Description.">\n'
        f"{ld}</head><body>\n{body}\n</body></html>\n"
    )


def sitemap(dates):
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for loc, last in dates.items():
        lines += [
            "  <url>",
            f"    <loc>{loc}</loc>",
            f"    <lastmod>{last}</lastmod>",
            "    <changefreq>monthly</changefreq>",
            "    <priority>0.7</priority>",
            "  </url>",
        ]
    lines += ["</urlset>", ""]
    return "\n".join(lines)


def lastmods(text):
    found = {}
    for block in re.findall(r"<url>(.*?)</url>", text, re.S):
        loc = re.search(r"<loc>(.*?)</loc>", block)
        last = re.search(r"<lastmod>(.*?)</lastmod>", block)
        if loc and last:
            found[loc.group(1).strip()] = last.group(1).strip()
    return found


def build_fixture(repo):
    repo = Path(repo)
    write(
        repo / "blog" / "old-post.html",
        html_page(
            f"{SITE}/blog/old-post.html",
            "<h1>Old Post</h1>",
            "2026-10-17",
        ),
    )
    write(
        repo / "locations" / "tomah.html",
        html_page(f"{SITE}/locations/tomah.html", "<h1>Tomah</h1>"),
    )
    write(
        repo / "blog" / "index.html",
        html_page(
            f"{SITE}/blog/",
            """<article>
  <span class="section-label">October 17, 2026</span>
  <h2><a href="old-post.html">Old Post</a></h2>
  <p>Existing guide.</p>
</article>
""",
        ),
    )
    write(
        repo / "index.html",
        html_page(
            f"{SITE}/",
            "<!-- LATEST_GUIDES:START -->\n<ul></ul>\n<!-- LATEST_GUIDES:END -->\n",
        ),
    )
    write(
        repo / "llms.txt",
        "# Fixture\n\n## Live Blog Posts\n\n"
        f"- {SITE}/blog/old-post.html — Old Post (October 17, 2026)\n",
    )
    dates = {
        f"{SITE}/": "2026-10-17",
        f"{SITE}/blog/": "2026-10-17",
        f"{SITE}/blog/old-post.html": "2026-10-17",
        f"{SITE}/locations/tomah.html": "2026-10-17",
    }
    write(repo / "sitemap.xml", sitemap(dates))
    (repo / "scripts").mkdir(parents=True, exist_ok=True)
    shutil.copy(ROOT / "scripts" / "build_sitemap.py", repo / "scripts" / "build_sitemap.py")
    write(
        repo / ".scheduled" / "blog" / "new-post.html.scheduled",
        "PUBLISH_DATE: 2026-10-20\n"
        + html_page(
            f"{SITE}/blog/new-post.html",
            "<h1>New Post Title</h1>",
            "2026-01-01",
        ),
    )
    write(
        repo / ".scheduled" / "blog" / "later-post.html.scheduled",
        "PUBLISH_DATE: 2026-12-01\n"
        + html_page(f"{SITE}/blog/later-post.html", "<h1>Later</h1>", "2026-12-01"),
    )
    git(repo, "init", "-b", "main")
    git(repo, "add", "-A")
    git(repo, "commit", "-m", "base pages", when="2026-10-17T15:00:00")
    old = (repo / "blog" / "old-post.html").read_text(encoding="utf-8")
    write(
        repo / "blog" / "old-post.html",
        old.replace("2026-10-17", "2026-10-18"),
    )
    text = (repo / "sitemap.xml").read_text(encoding="utf-8")
    text = text.replace(
        f"<loc>{SITE}/blog/old-post.html</loc>\n    <lastmod>2026-10-17</lastmod>",
        f"<loc>{SITE}/blog/old-post.html</loc>\n    <lastmod>2026-10-18</lastmod>",
    )
    write(repo / "sitemap.xml", text)
    git(repo, "add", "-A")
    git(repo, "commit", "-m", "update old post", when="2026-10-18T15:00:00")
    write(repo / "NOTES.txt", "tip commit does not touch HTML\n")
    git(repo, "add", "-A")
    git(repo, "commit", "-m", "unrelated tip", when="2026-10-19T15:00:00")


def clone_shallow(src, dst):
    proc = subprocess.run(
        [
            "git",
            "-c",
            "protocol.file.allow=always",
            "clone",
            "--depth",
            "1",
            "file://" + str(Path(src).resolve()),
            str(dst),
        ],
        text=True,
        capture_output=True,
    )
    if proc.returncode != 0:
        raise SystemExit(f"shallow clone failed:\n{proc.stderr}")
    visible = git(dst, "log", "-1", "--format=%cs", "--", "blog/old-post.html").stdout.strip()
    if visible != "2026-10-19":
        raise SystemExit(
            "depth-1 clone did not date the untouched old post to the tip "
            f"(got {visible!r}); this is the 055eb40 failure mode"
        )
    print(
        "depth-1 git log dates untouched blog/old-post.html as "
        f"{visible} (the tip commit; its real edit was 2026-10-18)"
    )


def publish(repo):
    env = os.environ.copy()
    env["PUBLISH_TODAY"] = PUBLISH_TODAY
    env["COUNT_FILE"] = str(Path(repo) / "published_count.txt")
    proc = subprocess.run(
        [sys.executable, str(ROOT / ".github" / "workflows" / "wire_in_posts.py")],
        cwd=repo,
        env=env,
        text=True,
        capture_output=True,
    )
    return proc


def expect(cond, message, failures):
    print(("PASS " if cond else "FAIL ") + message)
    if not cond:
        failures.append(message)


def check_repo(repo, label, failures):
    proc = publish(repo)
    print(f"--- {label} publisher stdout ---")
    print(proc.stdout.rstrip())
    if proc.stderr.strip():
        print(f"--- {label} publisher stderr ---")
        print(proc.stderr.rstrip())
    if proc.returncode != 0:
        expect(False, f"{label}: publisher exited {proc.returncode}", failures)
        return
    repo = Path(repo)
    new_html = (repo / "blog" / "new-post.html").read_text(encoding="utf-8")
    expect(
        '"datePublished":"2026-10-20"' in new_html,
        f"{label}: new post datePublished is 2026-10-20",
        failures,
    )
    expect(
        '"datePublished":"2026-01-01"' not in new_html,
        f"{label}: placeholder datePublished was replaced",
        failures,
    )
    dates = lastmods((repo / "sitemap.xml").read_text(encoding="utf-8"))
    expect(
        dates.get(f"{SITE}/blog/new-post.html") == PUBLISH_TODAY,
        f"{label}: new post lastmod is {PUBLISH_TODAY}",
        failures,
    )
    expect(
        dates.get(f"{SITE}/blog/old-post.html") == "2026-10-18",
        f"{label}: old post lastmod stayed 2026-10-18 (got {dates.get(f'{SITE}/blog/old-post.html')})",
        failures,
    )
    expect(
        dates.get(f"{SITE}/locations/tomah.html") == "2026-10-17",
        f"{label}: tomah lastmod stayed 2026-10-17 (got {dates.get(f'{SITE}/locations/tomah.html')})",
        failures,
    )
    expect(
        dates.get(f"{SITE}/") == PUBLISH_TODAY,
        f"{label}: homepage lastmod is {PUBLISH_TODAY} because Latest guides changed",
        failures,
    )
    expect(
        dates.get(f"{SITE}/blog/") == PUBLISH_TODAY,
        f"{label}: blog index lastmod is {PUBLISH_TODAY} because a card was added",
        failures,
    )
    expect(
        (repo / ".scheduled" / "blog" / "later-post.html.scheduled").is_file(),
        f"{label}: future scheduled post was not published",
        failures,
    )
    expect(
        not (repo / "blog" / "later-post.html").exists(),
        f"{label}: future post has no public file",
        failures,
    )


def main():
    failures = []
    with tempfile.TemporaryDirectory(prefix="publish-lastmod-") as tmp:
        origin = Path(tmp) / "origin"
        build_fixture(origin)
        full = Path(tmp) / "full"
        shallow = Path(tmp) / "shallow"
        shutil.copytree(origin, full, symlinks=True)
        check_repo(full, "full history", failures)
        clone_shallow(origin, shallow)
        check_repo(shallow, "shallow tip", failures)
    if failures:
        print(f"\n{len(failures)} check(s) failed")
        return 1
    print("\npublish lastmod checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
