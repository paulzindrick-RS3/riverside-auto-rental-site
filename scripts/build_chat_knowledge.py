#!/usr/bin/env python3
"""Extract the A1 knowledge slice into data/chat-knowledge.json.

A1 is the core published pages (home, fleet, contact, service, location),
the key policy blogs (deposits, what you need to rent, daily vs weekly
rates, insurance replacement), and llms.txt. Drafts under .scheduled/ are
never read. Nav, footer, scripts, and the chat widget itself are stripped.

Sentences that call a deposit refundable or give a hold-release time are
removed from this file only. The HTML pages are not edited.
"""
import html
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_sitemap  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = "data/chat-knowledge.json"

# The 17 core pages build_sitemap pins, in a stable read order.
CORE_PAGES = [
    "index.html",
    "fleet.html",
    "suv-rental.html",
    "van-rental.html",
    "full-size-car-rental.html",
    "young-driver-car-rental.html",
    "insurance-replacement-rental.html",
    "rent-local.html",
    "contact.html",
    "blog/index.html",
    "locations/index.html",
    "locations/tomah.html",
    "locations/sparta.html",
    "locations/neillsville.html",
    "locations/warrens.html",
    "locations/melrose.html",
    "locations/osseo.html",
]

# Pages that explain deposits, rental requirements, daily vs weekly rates,
# and insurance replacement. Seasonal posts stay out of v1.
POLICY_BLOGS = [
    "blog/car-rental-deposit-debit-card-black-river-falls.html",
    "blog/what-you-need-to-rent-a-car-black-river-falls.html",
    "blog/daily-vs-weekly-car-rental-rates.html",
    "blog/weekly-car-rental-rates-when-7-days-beats-daily.html",
    "blog/insurance-replacement-rental-cars-black-river-falls.html",
    "blog/does-car-insurance-cover-rental-car-wisconsin.html",
    "blog/same-day-insurance-replacement-rental-black-river-falls.html",
]

BANNED_PHRASES = (
    "refundable",
    "3 to 7 business days",
    "3-7 business days",
    "3–7 business days",
    "business days to release",
)

RELEASE_TIME = re.compile(r"\b\d+\s*(?:to|–|-)\s*\d+\s*business days?\b", re.I)
WIDGET_BLOCK = re.compile(
    r"<!-- rar-chat-widget -->.*?<!-- /rar-chat-widget -->", re.I | re.S
)


def is_published_path(path):
    norm = path.replace("\\", "/")
    while norm.startswith("./"):
        norm = norm[2:]
    norm = norm.lstrip("/")
    if not norm:
        return False
    for part in norm.split("/"):
        if part.startswith(".") or part.endswith(".scheduled") or ".scheduled" in part:
            return False
    return True


def page_type(path):
    norm = path.replace("\\", "/")
    if norm == "index.html":
        return "home"
    if norm == "fleet.html":
        return "fleet"
    if norm == "contact.html":
        return "contact"
    if norm == "llms.txt":
        return "summary"
    if norm.startswith("locations/"):
        return "location"
    if norm.startswith("blog/"):
        return "blog"
    return "service"


def page_url(path, source_html):
    if path == "llms.txt":
        return "https://riversideautorental.com/llms.txt"
    cans = build_sitemap.canonicals(source_html)
    if len(cans) == 1:
        return cans[0]
    return ""


def normalize_line(line):
    line = html.unescape(line).replace("\xa0", " ")
    line = re.sub(r"\s+", " ", line).strip()
    line = re.sub(r"(?:\s\|\s*)+$", "", line).strip()
    line = re.sub(r"^(?:\s*\|\s*)+", "", line).strip()
    return line


def sentence_blocked(sentence):
    """True when a sentence states a claim the assistant must not repeat."""
    raw = sentence.strip()
    if not raw:
        return False
    lower = raw.lower()
    if "refundable" in lower:
        return True
    if RELEASE_TIME.search(raw):
        return True
    has_hold = bool(re.search(r"\b(hold|deposit|funds)\b", lower))
    has_release = bool(re.search(r"\b(release|releases|released|releasing)\b", lower))
    if has_hold and has_release:
        return True
    if has_hold and "come back" in lower and ("how long" in lower or "how much we hold" in lower):
        return True
    if "how long does" in lower and "hold" in lower:
        return True
    if "not be immediately available" in lower:
        return True
    if "how quickly your bank" in lower or "how fast the hold" in lower:
        return True
    if "time it takes for the hold" in lower:
        return True
    if re.search(r"\brelease it\b", lower) or "when the vehicle comes back" in lower:
        return True
    if "the bank does the rest" in lower and "release" in lower:
        return True
    return False


def scrub_text(text):
    """Drop refundable-deposit and hold-release sentences. Pages stay unchanged."""
    kept = []
    for line in text.split("\n"):
        parts = re.split(r"(?<=[.!?])\s+", line)
        safe = [part for part in parts if not sentence_blocked(part)]
        line = " ".join(part.strip() for part in safe if part.strip()).strip()
        if line and not sentence_blocked(line):
            kept.append(line)
    return "\n".join(kept)


def visible_text(source):
    """Visible body text with chrome, scripts, and the chat widget removed."""
    text = WIDGET_BLOCK.sub(" ", source)
    text = re.sub(r"(?is)<script\b[^>]*>.*?</script>", " ", text)
    text = re.sub(r"(?is)<style\b[^>]*>.*?</style>", " ", text)
    text = re.sub(r"(?is)<noscript\b[^>]*>.*?</noscript>", " ", text)
    text = re.sub(r"(?is)<header\b[^>]*>.*?</header>", " ", text)
    text = re.sub(r"(?is)<nav\b[^>]*>.*?</nav>", " ", text)
    text = re.sub(r"(?is)<footer\b[^>]*>.*?</footer>", " ", text)
    text = re.sub(r"(?is)<div\b[^>]*\bcall-banner\b[^>]*>.*?</div>", " ", text)
    text = re.sub(r"(?is)<div\b[^>]*\bid=[\"']sms-bubble[\"'][^>]*>.*?</div>", " ", text)
    text = re.sub(r"(?is)<!--.*?-->", " ", text)
    text = re.sub(r"(?i)<br\s*/?>", "\n", text)
    text = re.sub(r"(?i)</t[dh]>", " | ", text)
    text = re.sub(r"(?i)</tr>", "\n", text)
    text = re.sub(r"(?i)</(p|div|li|h[1-6]|section|article|blockquote|figcaption|ul|ol)>", "\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    lines = []
    for line in text.splitlines():
        cleaned = normalize_line(line)
        if cleaned:
            lines.append(cleaned)
    return scrub_text("\n".join(lines))


def page_title(source, path):
    if path == "llms.txt":
        first = source.strip().splitlines()[0] if source.strip() else "llms.txt"
        return normalize_line(first.lstrip("# "))
    match = re.search(r"(?is)<title[^>]*>(.*?)</title>", source)
    if not match:
        return path
    return normalize_line(re.sub(r"(?s)<[^>]+>", " ", match.group(1)))


def dedupe_lines(text, seen):
    kept = []
    for line in text.split("\n"):
        key = line.strip().lower()
        if len(key) < 2:
            continue
        if key in seen:
            continue
        if key in {"text us", "call to reserve", "leave this field empty"}:
            continue
        seen.add(key)
        kept.append(line.strip())
    return "\n".join(kept)


def collect(root=None):
    root = root or ROOT
    sources = CORE_PAGES + POLICY_BLOGS + ["llms.txt"]
    pages = []
    seen = set()
    for rel in sources:
        if not is_published_path(rel):
            raise SystemExit(f"refusing to read an unpublished path: {rel}")
        path = os.path.join(root, rel)
        if not os.path.isfile(path):
            raise SystemExit(f"knowledge source missing: {rel}")
        raw = open(path, encoding="utf-8").read()
        if rel == "llms.txt":
            body = scrub_text("\n".join(normalize_line(line) for line in raw.splitlines() if normalize_line(line)))
            title = page_title(raw, rel)
            url = page_url(rel, raw)
        else:
            body = visible_text(raw)
            title = page_title(raw, rel)
            url = page_url(rel, raw)
        body = dedupe_lines(body, seen)
        if not body:
            continue
        pages.append(
            {
                "url": url,
                "path": rel.replace("\\", "/"),
                "title": title,
                "type": page_type(rel),
                "text": body,
            }
        )
    return pages


def payload(root=None):
    pages = collect(root)
    blob = json.dumps({"slice": "A1", "pages": pages}, ensure_ascii=False, indent=2)
    lowered = blob.lower()
    for phrase in BANNED_PHRASES:
        if phrase.lower() in lowered:
            raise SystemExit(f"knowledge still contains banned phrase: {phrase}")
    if ".scheduled" in blob:
        raise SystemExit("knowledge contains a .scheduled path")
    return blob + "\n"


def render(root=None):
    return payload(root)


def main():
    os.chdir(ROOT)
    text = render(ROOT)
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(text)
    count = json.loads(text)["pages"]
    print(f"{OUT_PATH}: {len(count)} page(s), {len(text)} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
