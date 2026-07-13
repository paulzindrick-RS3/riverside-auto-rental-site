# Blog Queue Bundle — 2026-07-13
Riverside Auto Rental (riversideautorental.com)

## What this is
Four new scheduled blog posts to refill the empty Tuesday queue, plus the updated
blog index with the Coming Soon section restored, plus llms.txt with one fleet fix.
The auto-publisher will flip each `.scheduled` → `.html` on its publish Tuesday.

## Publish schedule
| Date | Post | File |
|------|------|------|
| Tue Jul 14 | Jackson County Fair 2026: The Right Rental for Fair Week | `jackson-county-fair-2026-rental-black-river-falls.html.scheduled` |
| Tue Jul 21 | Ford Edge SUV Rental: What the SUV Class Gets You | `ford-edge-suv-rental-black-river-falls.html.scheduled` |
| Tue Jul 28 | Cranberry Festival Vans: The Midsummer Booking Window Is Now | `warrens-cranberry-festival-van-booking-update-2026.html.scheduled` |
| Tue Aug 4 | College Move-In: The Rental That Hauls the Dorm Room in One Trip | `college-move-in-rental-black-river-falls.html.scheduled` |

**Note on July 14:** the publisher runs Tuesdays. Upload TODAY (Monday) so the fair
post publishes tomorrow. If the Action has already run by the time you upload,
manually rename that one file `.scheduled` → `.html` AND delete its leading
`PUBLISH_DATE:` line (the known gotcha).

## Upload map (GitHub drag-and-drop → repo paulzindrick-RS3/riverside-auto-rental-site)
| File | Goes to | Action |
|------|---------|--------|
| `blog/` — all 4 `.scheduled` files | repo `/blog/` folder | Add new |
| `blog/index.html` | repo `/blog/index.html` | Replace existing |
| `llms.txt` | repo ROOT `/llms.txt` | Replace existing |

sitemap.xml: NO change needed now. Per house convention, queued posts don't enter
sitemap.xml or the llms "Live Blog Posts" list until they're actually live — that
stays a Wednesday step each week (the scheduled Wednesday check will flag it).

## Changes
**blog/index.html** — restored the "Coming Soon" section with four unlinked teasers
(one per queued post), inserted between the last article card and the "Need a
Rental?" CTA. No other changes; built from the file you uploaded today.

**llms.txt** — added the missing SUV/AWD class to the Fleet section (two Ford
Edges + AWD Outback, $80/$100 day, $480/$600 week). It was live on /fleet but
absent here. No blog-list changes; built from the file you uploaded today.

**Posts** — each follows the standard template: PUBLISH_DATE first line, canonical
`/blog/<slug>.html`, BlogPosting + BreadcrumbList + FAQPage JSON-LD, geo tags,
FAQ accordion, related-articles block, phone 715-396-1466 throughout.
Facts checked July 13: Jackson County Fair = July 28–Aug 2, 2026, Jackson County
Fair Park, 234 Melrose St; Warrens Cranberry Festival (53rd) = Sept 25–27, 2026;
SUV/AWD rates from live /fleet page.

## Wednesday wiring reminders (as each post goes live)
1. Move its teaser out of Coming Soon → dated article card at top of index
2. Add its URL to sitemap.xml (+ bump /blog/ lastmod)
3. Add it to llms.txt "Live Blog Posts" (top) + a summary bullet
