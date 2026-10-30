from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt


OUT = Path(__file__).resolve().parents[1] / "artifacts"
OUT.mkdir(exist_ok=True)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

INK = RGBColor(24, 34, 31)
MUTED = RGBColor(105, 117, 109)
PAPER = RGBColor(245, 241, 232)
WHITE = RGBColor(252, 250, 244)
DEEP = RGBColor(235, 229, 216)
SAGE = RGBColor(158, 180, 163)
OCHRE = RGBColor(215, 166, 70)
CLAY = RGBColor(201, 112, 88)
MIST = RGBColor(221, 227, 221)
BLUE = RGBColor(90, 130, 170)


def shape(slide, kind, x, y, w, h, fill, line=None, radius=False):
    s = slide.shapes.add_shape(kind, Inches(x), Inches(y), Inches(w), Inches(h))
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    s.line.color.rgb = line or fill
    if kind == MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE and radius:
        s.adjustments[0] = 0.12
    return s


def text(slide, value, x, y, w, h, size=16, color=INK, bold=False,
         font="Aptos", align=PP_ALIGN.LEFT, valign=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(0.04)
    tf.margin_right = Inches(0.04)
    tf.margin_top = Inches(0.02)
    tf.vertical_anchor = valign
    p = tf.paragraphs[0]
    p.alignment = align
    r = p.add_run()
    r.text = value
    r.font.name = font
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = color
    return box


def rich_lines(slide, lines, x, y, w, h, size=14, color=INK, leading=1.1):
    box = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = box.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(0.04)
    tf.margin_right = Inches(0.04)
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = line
        p.level = 0
        p.space_after = Pt(7)
        p.font.name = "Aptos"
        p.font.size = Pt(size)
        p.font.color.rgb = color
    return box


def title(slide, kicker, headline, sub=None):
    text(slide, kicker.upper(), 0.55, 0.35, 3.2, 0.25, 10, MUTED, True, "Aptos")
    text(slide, headline, 0.55, 0.68, 12.0, 0.7, 27, INK, True, "Georgia")
    if sub:
        text(slide, sub, 0.58, 1.38, 11.6, 0.35, 12, MUTED)


def footer(slide, source):
    text(slide, source, 0.58, 7.16, 11.8, 0.18, 8, MUTED)
    text(slide, "CYPHER SQUAD  /  PS-003", 11.25, 7.16, 1.5, 0.18, 8, MUTED, True, align=PP_ALIGN.RIGHT)


def bullet_card(slide, x, y, w, h, accent, heading, body):
    shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, x, y, w, h, WHITE, MIST, True)
    shape(slide, MSO_AUTO_SHAPE_TYPE.RECTANGLE, x, y, 0.08, h, accent)
    text(slide, heading, x + 0.22, y + 0.16, w - 0.35, 0.3, 15, INK, True, "Georgia")
    text(slide, body, x + 0.22, y + 0.54, w - 0.35, h - 0.68, 11, MUTED)


def pill(slide, label, x, y, w, fill, color=INK):
    shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, x, y, w, 0.32, fill, fill, True)
    text(slide, label, x, y + 0.055, w, 0.18, 9, color, True, align=PP_ALIGN.CENTER)


def arrow(slide, x1, y1, x2, y2, color=INK, width=1.6):
    line = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    line.line.color.rgb = color
    line.line.width = Pt(width)
    line.line.end_arrowhead = True
    return line


def new_slide(bg=PAPER):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = bg
    return slide


# 1. Cover
slide = new_slide()
shape(slide, MSO_AUTO_SHAPE_TYPE.RECTANGLE, 0, 0, 13.333, 7.5, PAPER)
shape(slide, MSO_AUTO_SHAPE_TYPE.RECTANGLE, 8.95, 0, 4.383, 7.5, DEEP)
shape(slide, MSO_AUTO_SHAPE_TYPE.OVAL, 9.55, 1.0, 2.8, 2.8, SAGE)
shape(slide, MSO_AUTO_SHAPE_TYPE.OVAL, 10.4, 1.85, 1.1, 1.1, INK)
shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 9.5, 4.45, 2.8, 1.55, WHITE, MIST, True)
text(slide, "01", 0.65, 0.52, 0.6, 0.35, 12, MUTED, True)
text(slide, "Small Web\nReader", 0.62, 1.32, 6.2, 1.5, 42, INK, True, "Georgia")
text(slide, "A local-first RSS/Atom reader with anonymous, algorithm-free discovery for independent blogs.", 0.68, 3.15, 5.65, 0.8, 19, MUTED)
pill(slide, "PRIVATE BY DEFAULT", 0.68, 4.55, 1.55, SAGE)
pill(slide, "OFFLINE-FIRST", 2.35, 4.55, 1.22, OCHRE)
pill(slide, "NO ACCOUNTS", 3.72, 4.55, 1.18, CLAY, WHITE)
text(slide, "Cypher Squad", 0.68, 6.52, 2.0, 0.28, 13, INK, True)
text(slide, "PS-003  /  Web Reader: Anonymous Discovery for Independent Blogs", 0.68, 6.88, 6.0, 0.22, 9, MUTED)
text(slide, "Direct subscriptions.\nCalm reading.\nUseful discovery.", 9.78, 4.72, 2.2, 0.85, 18, INK, True, "Georgia", align=PP_ALIGN.CENTER)

# 2. Problem
slide = new_slide()
title(slide, "01 / Understanding the problem", "The open web is rich. Discovery is not.", "PS-003 asks for discovery without recreating the tracking-heavy feed.")
bullet_card(slide, 0.62, 2.05, 3.7, 2.0, CLAY, "Algorithmic feeds", "Ranking, ads and engagement loops decide what people see.")
bullet_card(slide, 4.82, 2.05, 3.7, 2.0, OCHRE, "Independent blogs", "RSS/Atom gives direct ownership, but assumes readers already know the feed URL.")
bullet_card(slide, 9.02, 2.05, 3.7, 2.0, SAGE, "The gap", "How do you discover something new without building a personal profile?")
arrow(slide, 2.48, 4.2, 2.48, 4.8, MUTED)
arrow(slide, 6.68, 4.2, 6.68, 4.8, MUTED)
arrow(slide, 10.88, 4.2, 10.88, 4.8, MUTED)
shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 1.15, 4.82, 11.0, 1.18, INK, INK, True)
text(slide, "Design target", 1.45, 5.05, 1.4, 0.22, 10, SAGE, True)
text(slide, "Use aggregate co-subscription patterns — not identity, clicks or reading history — to surface the next good blog.", 2.85, 4.98, 8.75, 0.42, 18, WHITE, True, "Georgia")
footer(slide, "Evidence: docs/problem_statement_3_clean.txt; IMPLEMENTATION_PLAN.md §1–3")

# 3. Innovation
slide = new_slide()
title(slide, "02 / Innovation", "Discovery built from overlap, not surveillance.", "A small graph can be useful without becoming a user-tracking system.")
shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 0.72, 2.0, 5.0, 4.15, WHITE, MIST, True)
text(slide, "Anonymous batch", 1.05, 2.28, 2.0, 0.28, 14, INK, True, "Georgia")
text(slide, "A reader may explicitly contribute up to 20 feed URLs once. The server stores only aggregate counters.", 1.05, 2.68, 4.1, 0.65, 13, MUTED)
for i, (label, y, col) in enumerate([("Moss & Signal", 3.62, SAGE), ("Quiet Machines", 4.15, OCHRE), ("The Long Afternoon", 4.68, CLAY)]):
    shape(slide, MSO_AUTO_SHAPE_TYPE.OVAL, 1.1, y, 0.24, 0.24, col)
    text(slide, label, 1.48, y - 0.01, 2.7, 0.24, 11, INK, True)
text(slide, "No account\nNo persistent ID\nNo reading history", 3.92, 3.58, 1.3, 1.1, 11, MUTED, True, align=PP_ALIGN.CENTER)
shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 6.35, 2.0, 6.25, 4.15, INK, INK, True)
text(slide, "What the graph learns", 6.72, 2.28, 3.2, 0.28, 14, SAGE, True, "Georgia")
text(slide, "A + B appears together often\n→ B becomes relevant to someone following A", 6.72, 2.7, 5.0, 0.68, 17, WHITE, True, "Georgia")
for x, y, label, col in [(7.1, 4.25, "A", SAGE), (9.3, 3.65, "B", OCHRE), (9.55, 5.0, "C", CLAY)]:
    shape(slide, MSO_AUTO_SHAPE_TYPE.OVAL, x, y, 0.62, 0.62, col)
    text(slide, label, x, y + 0.15, 0.62, 0.22, 16, INK, True, align=PP_ALIGN.CENTER)
arrow(slide, 7.73, 4.53, 9.25, 4.0, SAGE, 2.2)
arrow(slide, 7.73, 4.53, 9.45, 5.28, SAGE, 2.2)
text(slide, "The novelty is the boundary: useful aggregate signal, no personal profile.", 6.72, 5.72, 5.1, 0.3, 12, MIST, True)
footer(slide, "Evidence: PRODUCT.md §3D; src/lib/discovery.ts; functions/src/discovery.ts")

# 4. System design
slide = new_slide()
title(slide, "03 / System design", "One reader. Two data planes. Clear boundaries.", "Content stays local; the backend only handles raw fetches and aggregate discovery.")
shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 0.58, 1.92, 5.3, 4.55, WHITE, MIST, True)
text(slide, "Browser / local-first plane", 0.88, 2.18, 3.3, 0.3, 15, INK, True, "Georgia")
for i, (head, body, col) in enumerate([
    ("React + Vite PWA", "Timeline, subscriptions, Discover, Reader", SAGE),
    ("Parser + extractor", "RSS/Atom parsing, Readability, DOMPurify", OCHRE),
    ("Dexie / IndexedDB", "Feeds, posts, articles, viewed state, outbox", CLAY),
]):
    yy = 2.75 + i * 0.92
    shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 0.92, yy, 4.6, 0.66, DEEP, DEEP, True)
    shape(slide, MSO_AUTO_SHAPE_TYPE.OVAL, 1.12, yy + 0.17, 0.3, 0.3, col)
    text(slide, head, 1.58, yy + 0.11, 2.3, 0.22, 11, INK, True)
    text(slide, body, 1.58, yy + 0.34, 3.35, 0.18, 9, MUTED)
shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 7.35, 1.92, 5.4, 4.55, INK, INK, True)
text(slide, "Backend / aggregate plane", 7.68, 2.18, 3.3, 0.3, 15, WHITE, True, "Georgia")
for i, (head, body, col) in enumerate([
    ("/api/fetch", "Raw upstream content only; SSRF/timeout/size limits", SAGE),
    ("Discovery API", "Popular, recommendations, explicit contribution", OCHRE),
    ("Firestore", "feeds + feedPairs + receipts + rate limits", CLAY),
]):
    yy = 2.75 + i * 0.92
    shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 7.7, yy, 4.7, 0.66, RGBColor(41, 54, 49), RGBColor(66, 82, 75), True)
    shape(slide, MSO_AUTO_SHAPE_TYPE.OVAL, 7.9, yy + 0.17, 0.3, 0.3, col)
    text(slide, head, 8.36, yy + 0.11, 2.3, 0.22, 11, WHITE, True)
    text(slide, body, 8.36, yy + 0.34, 3.55, 0.18, 9, MIST)
arrow(slide, 5.95, 4.15, 7.32, 4.15, OCHRE, 2.3)
text(slide, "only when needed", 6.05, 3.72, 1.25, 0.2, 9, MUTED, True, align=PP_ALIGN.CENTER)
footer(slide, "Evidence: DESIGN.md §1–3; README.md architecture and route contracts; firebase.json rewrites")

# 5. Flow
slide = new_slide()
title(slide, "04 / Product flow", "From feed URL to calm, resilient reading.", "The happy path is simple; the edge paths are deliberate.")
steps = [
    ("1", "Add", "Autodiscover RSS/Atom\nor common feed paths", SAGE),
    ("2", "Parse", "Normalize entries\nand deduplicate posts", OCHRE),
    ("3", "Read", "Extract + sanitize\nfull text in browser", CLAY),
    ("4", "Cache", "Keep posts/articles\navailable offline", BLUE),
    ("5", "Discover", "Opt in, see reasons,\ncontribute separately", INK),
]
for i, (n, head, body, col) in enumerate(steps):
    x = 0.55 + i * 2.55
    shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, x, 2.15, 2.15, 2.0, WHITE, MIST, True)
    shape(slide, MSO_AUTO_SHAPE_TYPE.OVAL, x + 0.16, 2.36, 0.42, 0.42, col)
    text(slide, n, x + 0.16, 2.47, 0.42, 0.16, 11, WHITE if col == INK else INK, True, align=PP_ALIGN.CENTER)
    text(slide, head, x + 0.68, 2.32, 1.2, 0.25, 14, INK, True, "Georgia")
    text(slide, body, x + 0.18, 3.0, 1.75, 0.7, 11, MUTED)
    if i < len(steps) - 1:
        arrow(slide, x + 2.18, 3.12, x + 2.48, 3.12, MUTED, 1.5)
shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 0.95, 4.92, 11.45, 1.0, INK, INK, True)
text(slide, "Demo story", 1.25, 5.18, 1.2, 0.22, 10, SAGE, True)
text(slide, "Follow a feed → open a clean article → go offline → keep reading → opt in to discover a relevant blog.", 2.45, 5.08, 9.25, 0.4, 16, WHITE, True, "Georgia")
footer(slide, "Evidence: src/App.tsx; src/lib/feed-core.ts; src/lib/article.ts; src/lib/db.ts")

# 6. Trust
slide = new_slide()
title(slide, "05 / Trust by construction", "Privacy is not a footer. It is the architecture.", "The strongest differentiator is what the system refuses to collect.")
cards = [
    ("Private by default", "Subscription URLs stay local unless personalized discovery is enabled.", SAGE),
    ("Safe fetch boundary", "SSRF checks, DNS validation, redirect revalidation, 8s timeout, 2 MiB cap.", OCHRE),
    ("Abuse resistance", "App Check, HMAC-derived rate-limit keys, endpoint limits, idempotent receipts.", CLAY),
    ("Safe rendering", "Readability extraction and DOMPurify sanitization before article HTML is rendered.", BLUE),
]
for i, (head, body, col) in enumerate(cards):
    x = 0.62 + (i % 2) * 6.1
    y = 2.05 + (i // 2) * 1.72
    bullet_card(slide, x, y, 5.55, 1.35, col, head, body)
shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 1.8, 5.64, 9.75, 0.62, INK, INK, True)
text(slide, "NEVER STORED: accounts • raw IPs • reading history • raw feed XML • article HTML • persistent subscription profiles", 2.05, 5.84, 9.2, 0.2, 10, WHITE, True, align=PP_ALIGN.CENTER)
footer(slide, "Evidence: README.md privacy/threat model; api/fetch.ts; functions/src/security.ts; firestore.rules")

# 7. Tests
slide = new_slide()
title(slide, "06 / Proof", "70 tests passed. The edge cases are the product.", "Validation is aimed at the failure modes that would break trust or usefulness.")
shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 0.62, 2.0, 2.2, 3.65, INK, INK, True)
text(slide, "71", 0.82, 2.52, 1.8, 0.75, 48, SAGE, True, "Georgia", align=PP_ALIGN.CENTER)
text(slide, "tests passed", 0.85, 3.35, 1.75, 0.25, 14, WHITE, True, align=PP_ALIGN.CENTER)
text(slide, "10 test files", 0.85, 3.85, 1.75, 0.25, 12, MIST, align=PP_ALIGN.CENTER)
text(slide, "npm test\nnpm run build", 0.85, 4.55, 1.75, 0.55, 11, MIST, True, align=PP_ALIGN.CENTER)
test_cards = [
    ("Feed resilience", "RSS, Atom, RDF, malformed XML, empty feeds, deduplication"),
    ("Security", "Private IPv4/IPv6, metadata hosts, credentials, secret query keys, redirects"),
    ("Discovery integrity", "Followed-feed exclusion, score weighting, 20-feed / 190-pair cap, idempotency"),
    ("Offline + portability", "OPML round-trip, theme persistence, local cache and outbox behavior"),
]
for i, (head, body) in enumerate(test_cards):
    x = 3.18 + (i % 2) * 4.7
    y = 2.0 + (i // 2) * 1.82
    bullet_card(slide, x, y, 4.25, 1.38, [SAGE, OCHRE, CLAY, BLUE][i], head, body)
shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 8.02, 5.64, 4.55, 0.65, DEEP, DEEP, True)
text(slide, "Honest limitation: no full browser E2E proof of the complete journey yet.", 8.25, 5.84, 4.08, 0.22, 9, INK, True, align=PP_ALIGN.CENTER)
footer(slide, "Evidence: npm test output; src/test/*.test.ts; seed-audit-report.md")

# 8. Impact / close
slide = new_slide()
title(slide, "07 / Impact & feasibility", "A practical alternative to the engagement feed.", "Useful now, deployable with the documented Firebase/Vercel paths, and extensible without collecting more personal data.")
impact = [
    ("For readers", "Own your subscriptions. Read offline. Discover without being profiled.", SAGE),
    ("For bloggers", "Direct distribution and visibility beyond the biggest platforms.", OCHRE),
    ("For operators", "Small surface area: one PWA, one API layer, one aggregate store.", CLAY),
]
for i, (head, body, col) in enumerate(impact):
    x = 0.72 + i * 4.15
    bullet_card(slide, x, 2.05, 3.65, 1.72, col, head, body)
shape(slide, MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE, 0.72, 4.35, 11.9, 1.35, INK, INK, True)
text(slide, "Ready to show", 1.05, 4.62, 1.35, 0.22, 10, SAGE, True)
text(slide, "1. Add a feed   2. Read extracted article   3. Disconnect   4. Discover with opt-in   5. Explain the boundary", 2.45, 4.55, 9.55, 0.3, 17, WHITE, True, "Georgia")
text(slide, "Repository: PECathon-2026/Cypher-Squad", 1.05, 5.16, 5.0, 0.2, 10, MIST)
text(slide, "Small Web Reader: calm reading, useful discovery, no personal profile.", 0.72, 6.52, 11.9, 0.34, 21, INK, True, "Georgia", align=PP_ALIGN.CENTER)
footer(slide, "Evidence: README.md setup/deployment; PRODUCT.md; firebase.json; implementation build/tests")

prs.save(OUT / "PS003_Small_Web_Reader_Cypher_Squad.pptx")
print(OUT / "PS003_Small_Web_Reader_Cypher_Squad.pptx")
