#!/usr/bin/env python3
"""
Generates FolioView's bundled demo PDFs and its test fixtures.

The generated files are committed, so you only need this script if you want
to change them. Requires: pip install reportlab

    python3 scripts/generate_pdfs.py

Outputs
  public/demo/*.pdf          demo documents shown on the dashboard (fictional content)
  tests/fixtures/*.pdf       edge-case documents used by Vitest and Playwright
"""
import os
import random
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEMO = os.path.join(ROOT, "public", "demo")
FIX = os.path.join(ROOT, "tests", "fixtures")

INK = HexColor("#151A22")
CANVAS = HexColor("#F7F6F2")
STONE = HexColor("#D7D9D3")
SAGE = HexColor("#A3AD9B")
GOLD = HexColor("#C7A878")
MUTED = HexColor("#5B6370")


def fake_photo(c, x, y, w, h, seed, palette=None):
    """A soft gradient 'photograph' placeholder with simple architectural shapes."""
    rnd = random.Random(seed)
    palette = palette or [
        ("#C9D3D8", "#8FA1A8"),
        ("#E3D6C1", "#A8957A"),
        ("#CBD3C4", "#7F8C76"),
        ("#D9D2C9", "#9C8F84"),
    ]
    top, bottom = palette[seed % len(palette)]
    c.saveState()
    p = c.beginPath()
    p.rect(x, y, w, h)
    c.clipPath(p, stroke=0, fill=0)
    c.linearGradient(x, y + h, x, y, (HexColor(top), HexColor(bottom)), extend=True)
    # horizon & building blocks
    c.setFillColor(Color(1, 1, 1, alpha=0.18))
    c.rect(x, y, w, h * 0.38, stroke=0, fill=1)
    for _ in range(rnd.randint(3, 6)):
        bw = w * rnd.uniform(0.12, 0.3)
        bh = h * rnd.uniform(0.25, 0.6)
        bx = x + rnd.uniform(0, w - bw)
        c.setFillColor(Color(0.08, 0.1, 0.13, alpha=rnd.uniform(0.08, 0.22)))
        c.rect(bx, y + h * 0.2, bw, bh, stroke=0, fill=1)
    c.setFillColor(Color(1, 1, 1, alpha=0.35))
    c.circle(x + w * rnd.uniform(0.6, 0.85), y + h * rnd.uniform(0.7, 0.85), min(w, h) * 0.07, stroke=0, fill=1)
    c.restoreState()


def folio(c, w, n, total, label):
    c.setFont("Helvetica", 7.5)
    c.setFillColor(MUTED)
    c.drawString(40, 26, label.upper())
    c.drawRightString(w - 40, 26, f"{n:02d} / {total:02d}")


# ---------------------------------------------------------------- demo docs

def property_brochure(path):
    w, h = A4
    c = canvas.Canvas(path, pagesize=A4)
    c.setTitle("Harbourview Terrace — Sample Property Brochure")
    c.setAuthor("FolioView demo")
    total = 12
    label = "Harbourview Terrace · sample brochure"

    # 1 cover
    c.setFillColor(INK); c.rect(0, 0, w, h, stroke=0, fill=1)
    fake_photo(c, 0, h * 0.34, w, h * 0.66, 3)
    c.setFillColor(GOLD); c.rect(40, h * 0.34 - 2, 60, 4, stroke=0, fill=1)
    c.setFillColor(CANVAS); c.setFont("Times-Roman", 44)
    c.drawString(40, h * 0.24, "Harbourview")
    c.drawString(40, h * 0.24 - 48, "Terrace")
    c.setFont("Helvetica", 10); c.setFillColor(STONE)
    c.drawString(40, 90, "4 BEDROOMS  ·  2 BATHROOMS  ·  2 CAR  ·  612 m² SECTION")
    c.setFont("Helvetica", 8); c.setFillColor(SAGE)
    c.drawString(40, 60, "SAMPLE DOCUMENT — FICTIONAL PROPERTY FOR DEMONSTRATION ONLY")
    c.showPage()

    sections = [
        ("Welcome home", "Light-filled family living with a north-facing aspect and calm harbour outlook."),
        ("The living", "Open-plan lounge and dining flowing to a sheltered deck."),
        ("The kitchen", "Stone benchtops, scullery, and integrated appliances."),
        ("Bedrooms", "Four double bedrooms, master with ensuite and walk-in robe."),
        ("Outdoors", "Level lawn, established planting, and a covered entertaining area."),
        ("Floor plan", "Indicative layout. Measurements approximate."),
        ("Neighbourhood", "Close to parks, cafés, schools, and coastal walkways."),
        ("Property facts", "Key details at a glance."),
        ("Schools & transport", "Zoning and commute times are indicative only."),
        ("Method of sale", "Sample text — no real sale is being advertised."),
    ]
    for i, (title, body) in enumerate(sections, start=2):
        c.setFillColor(CANVAS); c.rect(0, 0, w, h, stroke=0, fill=1)
        c.setFillColor(GOLD); c.setFont("Helvetica-Bold", 8)
        c.drawString(40, h - 60, f"{i - 1:02d}")
        c.setFillColor(INK); c.setFont("Times-Roman", 30)
        c.drawString(40, h - 100, title)
        c.setFont("Helvetica", 11); c.setFillColor(MUTED)
        c.drawString(40, h - 124, body)
        if title == "Floor plan":
            c.setStrokeColor(INK); c.setLineWidth(1.4)
            c.rect(60, 160, w - 120, h - 340)
            c.line(60, 420, w - 60, 420); c.line(280, 160, 280, 420); c.line(380, 420, 380, h - 180)
            c.setFont("Helvetica", 9); c.setFillColor(INK)
            for (tx, ty, t) in [(120, 300, "LIVING 6.2 × 5.1"), (310, 300, "KITCHEN 4.0 × 3.6"),
                                (120, 560, "BED 1 4.2 × 3.8"), (420, 560, "BED 2 3.6 × 3.2")]:
                c.drawString(tx, ty, t)
        elif title in ("Property facts", "Schools & transport"):
            facts = [("Land area", "612 m²"), ("Floor area", "214 m²"), ("Built", "2014"), ("Rates", "Sample only"),
                     ("Title", "Freehold"), ("Zoning", "Residential"), ("Parking", "Double garage"), ("Heating", "Heat pump")]
            y = h - 190
            for k, v in facts:
                c.setStrokeColor(STONE); c.line(40, y - 10, w - 40, y - 10)
                c.setFillColor(MUTED); c.setFont("Helvetica", 10); c.drawString(40, y, k)
                c.setFillColor(INK); c.setFont("Helvetica-Bold", 10); c.drawRightString(w - 40, y, v)
                y -= 36
        else:
            fake_photo(c, 40, 200, w - 80, h - 360, i)
            if i % 2 == 0:
                fake_photo(c, 40, 70, (w - 92) / 2, 112, i + 7)
                fake_photo(c, 52 + (w - 92) / 2, 70, (w - 92) / 2, 112, i + 11)
        folio(c, w, i, total, label)
        c.showPage()

    # back cover
    c.setFillColor(INK); c.rect(0, 0, w, h, stroke=0, fill=1)
    c.setFillColor(GOLD); c.rect(w / 2 - 30, h / 2 + 40, 60, 3, stroke=0, fill=1)
    c.setFillColor(CANVAS); c.setFont("Times-Roman", 26)
    c.drawCentredString(w / 2, h / 2, "Thank you for viewing")
    c.setFont("Helvetica", 9); c.setFillColor(STONE)
    c.drawCentredString(w / 2, h / 2 - 28, "Sample brochure generated for FolioView. Not a real listing.")
    c.showPage()
    c.save()


def portfolio(path):
    w, h = landscape(A4)
    c = canvas.Canvas(path, pagesize=(w, h))
    c.setTitle("Studio Portfolio — Sample")
    total = 8
    c.setFillColor(CANVAS); c.rect(0, 0, w, h, stroke=0, fill=1)
    c.setFillColor(INK); c.setFont("Times-Roman", 54); c.drawString(50, h / 2, "Selected Work")
    c.setFont("Helvetica", 11); c.setFillColor(MUTED); c.drawString(52, h / 2 - 30, "Interiors · Identity · Print — sample portfolio")
    c.setFillColor(SAGE); c.rect(w - 260, 0, 260, h, stroke=0, fill=1)
    c.showPage()
    for i in range(2, total + 1):
        c.setFillColor(CANVAS); c.rect(0, 0, w, h, stroke=0, fill=1)
        fake_photo(c, 40, 60, w * 0.6, h - 120, i * 5, [("#E8E1D6", "#B9A88E"), ("#D6DDD8", "#93A296")])
        c.setFillColor(INK); c.setFont("Times-Roman", 26); c.drawString(w * 0.6 + 70, h - 110, f"Project {i - 1:02d}")
        c.setFont("Helvetica", 10); c.setFillColor(MUTED)
        for j, line in enumerate(["Brief, process and outcome.", "Sample copy for layout preview.", "Year 2026"]):
            c.drawString(w * 0.6 + 70, h - 140 - j * 16, line)
        folio(c, w, i, total, "Studio portfolio · sample")
        c.showPage()
    c.save()


def deck(path):
    w, h = 960, 540  # 16:9
    c = canvas.Canvas(path, pagesize=(w, h))
    c.setTitle("Vendor Meeting Deck — Sample")
    slides = ["Market update", "Recent comparable sales", "Buyer enquiry", "Marketing plan", "Timeline", "Next steps"]
    c.setFillColor(INK); c.rect(0, 0, w, h, stroke=0, fill=1)
    c.setFillColor(CANVAS); c.setFont("Times-Roman", 48); c.drawString(60, h / 2, "Vendor Meeting")
    c.setFillColor(GOLD); c.setFont("Helvetica", 14); c.drawString(62, h / 2 - 34, "Sample presentation deck")
    c.showPage()
    for i, s in enumerate(slides, start=2):
        c.setFillColor(CANVAS); c.rect(0, 0, w, h, stroke=0, fill=1)
        c.setFillColor(INK); c.setFont("Times-Roman", 34); c.drawString(60, h - 90, s)
        c.setFillColor(GOLD); c.rect(60, h - 108, 50, 3, stroke=0, fill=1)
        rnd = random.Random(i)
        bars = [rnd.uniform(0.3, 1) for _ in range(6)]
        for j, b in enumerate(bars):
            c.setFillColor(SAGE if j % 2 else STONE)
            c.rect(80 + j * 120, 80, 80, 300 * b, stroke=0, fill=1)
        c.setFont("Helvetica", 9); c.setFillColor(MUTED); c.drawRightString(w - 40, 24, f"{i} / {len(slides) + 1}")
        c.showPage()
    c.save()


# ---------------------------------------------------------------- fixtures

def numbered(path, pages, size=A4, title=None, encrypt=None):
    w, h = size
    c = canvas.Canvas(path, pagesize=size, encrypt=encrypt)
    c.setTitle(title or os.path.basename(path))
    for n in range(1, pages + 1):
        c.setFillColor(CANVAS); c.rect(0, 0, w, h, stroke=0, fill=1)
        c.setFillColor(GOLD if n % 2 else SAGE); c.rect(0, h - 24, w, 24, stroke=0, fill=1)
        c.setFillColor(INK); c.setFont("Helvetica-Bold", min(w, h) * 0.3)
        c.drawCentredString(w / 2, h / 2 - min(w, h) * 0.1, str(n))
        c.setFont("Helvetica", 12); c.drawCentredString(w / 2, 40, f"Page {n} of {pages}")
        c.showPage()
    c.save()


def main():
    os.makedirs(DEMO, exist_ok=True)
    os.makedirs(FIX, exist_ok=True)
    property_brochure(os.path.join(DEMO, "harbourview-terrace-brochure.pdf"))
    portfolio(os.path.join(DEMO, "studio-portfolio.pdf"))
    deck(os.path.join(DEMO, "vendor-meeting-deck.pdf"))

    numbered(os.path.join(FIX, "one-page.pdf"), 1)
    numbered(os.path.join(FIX, "two-page.pdf"), 2)
    numbered(os.path.join(FIX, "three-page.pdf"), 3)
    numbered(os.path.join(FIX, "large-120.pdf"), 120)
    numbered(os.path.join(FIX, "a4-landscape.pdf"), 4, size=landscape(A4))
    numbered(os.path.join(FIX, "encrypted.pdf"), 3, encrypt="folio")  # user password: folio

    with open(os.path.join(FIX, "one-page.pdf"), "rb") as f:
        good = f.read()
    rnd = random.Random(7)
    with open(os.path.join(FIX, "corrupt.pdf"), "wb") as f:
        # valid signature, garbage body: passes signature check, fails in PDF.js
        f.write(b"%PDF-1.7\n" + bytes(rnd.getrandbits(8) for _ in range(4096)))
    with open(os.path.join(FIX, "truncated.pdf"), "wb") as f:
        f.write(good[: len(good) // 3])
    with open(os.path.join(FIX, "not-a-pdf.pdf"), "wb") as f:
        # PNG signature with a .pdf extension
        f.write(b"\x89PNG\r\n\x1a\n" + bytes(512))
    print("Generated demo PDFs and fixtures.")


if __name__ == "__main__":
    main()
