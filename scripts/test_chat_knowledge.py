#!/usr/bin/env python3
"""Knowledge extraction: A1 slice, no drafts, no refundable/hold-release claims."""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_chat_knowledge as knowledge  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPECTED = knowledge.CORE_PAGES + knowledge.POLICY_BLOGS + ["llms.txt"]
DRAFT_PHRASE = "January brings a lot of in-between situations."


def expect(cond, message, failures):
    print(("PASS " if cond else "FAIL ") + message)
    if not cond:
        failures.append(message)


def main():
    os.chdir(ROOT)
    failures = []
    text = knowledge.render(ROOT)
    disk = open(knowledge.OUT_PATH, encoding="utf-8").read()
    expect(text == disk, "data/chat-knowledge.json matches a fresh extract", failures)
    expect(text == knowledge.render(ROOT), "extract is deterministic", failures)

    data = json.loads(text)
    paths = [page["path"] for page in data["pages"]]
    expect(paths == [p for p in EXPECTED if p in paths], "page order follows the A1 list", failures)
    expect(set(paths) == set(EXPECTED), f"A1 paths match ({len(paths)} pages)", failures)
    expect(all(knowledge.is_published_path(p) for p in paths), "every path is a published source", failures)
    expect(".scheduled" not in text, "no .scheduled path in the JSON", failures)
    expect(DRAFT_PHRASE not in text, "queued long-term draft is not in the slice", failures)
    expect(
        all("thanksgiving-travel-rental" not in page["path"] for page in data["pages"]),
        "seasonal blog stays out of A1",
        failures,
    )
    expect(
        all(page["path"] != "cheap-car-rental.html" for page in data["pages"]),
        "A1 does not add pages outside the core list",
        failures,
    )

    blob = text.lower()
    for phrase in knowledge.BANNED_PHRASES:
        expect(phrase.lower() not in blob, f"scrubbed phrase absent: {phrase}", failures)
    expect("security deposit" in blob, "deposit wording remains", failures)
    expect("$55" in text and "$135" in text and "$300" in text, "posted rates remain", failures)
    expect("715-396-1466" in text, "desk phone remains", failures)
    expect("21" in text, "minimum age remains", failures)

    joined = "\n".join(page["text"] for page in data["pages"])
    expect("refundable" not in joined.lower(), "page text has no refundable claim", failures)
    expect("when the vehicle comes back" not in joined.lower(), "hold-release leftover is scrubbed", failures)

    sample = knowledge.scrub_text(
        "A security deposit, starting at $300, is held on a card. "
        "The deposit is refundable after the vehicle is returned. "
        "A deposit hold on a debit card typically takes 3 to 7 business days to release."
    )
    expect("$300" in sample, "scrub keeps the deposit amount", failures)
    expect("refundable" not in sample.lower(), "scrub drops refundable", failures)
    expect("business days" not in sample.lower(), "scrub drops the release window", failures)
    expect(not knowledge.is_published_path(".scheduled/blog/x.html"), "scheduled dir is unpublished", failures)
    expect(
        not knowledge.is_published_path("blog/post.html.scheduled"),
        "scheduled suffix is unpublished",
        failures,
    )

    expect(
        ".scheduled/blog/secret.html" not in EXPECTED,
        "allowlist does not name a draft",
        failures,
    )

    if failures:
        print(f"\n{len(failures)} knowledge check(s) failed")
        return 1
    print(f"\nknowledge checks passed ({len(paths)} sources)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
