"""Add one Privacy link inside an existing footer. Idempotent.

Standard pages get it in the Quick Links list, after Blog. The shorter
location footers get it beside the email address. Page copy outside the
footer is left alone.
"""

BLOG_ITEM = '<li><a href="/blog/">Blog</a></li>'
EMAIL_ANCHOR = (
    'mailto:contact@riversideautorental.com">contact@riversideautorental.com</a>'
)
PRIVACY_HREF = 'href="/privacy.html"'


def add_privacy_link(html):
    if PRIVACY_HREF in html:
        return html
    start = html.lower().rfind("<footer")
    if start < 0:
        return html
    end = html.lower().find("</footer>", start)
    if end < 0:
        end = len(html)
    footer = html[start:end]
    if BLOG_ITEM in footer:
        idx = footer.find(BLOG_ITEM)
        line_start = footer.rfind("\n", 0, idx) + 1
        prefix = footer[line_start:idx]
        item = '<li><a href="/privacy.html">Privacy</a></li>'
        if prefix.strip() == "":
            replacement = BLOG_ITEM + "\n" + prefix + item
        else:
            replacement = BLOG_ITEM + item
        footer = footer.replace(BLOG_ITEM, replacement, 1)
    elif EMAIL_ANCHOR in footer:
        footer = footer.replace(EMAIL_ANCHOR, EMAIL_ANCHOR + ' · <a href="/privacy.html">Privacy</a>', 1)
    else:
        return html
    return html[:start] + footer + html[end:]
