# Trends deck — the swipeable card format

**Decided 2026-09-11 (owner brief).** A trends story is no longer one square
card. It is a DECK: card 1 carries the headline and the key figure, the cards
after it carry one idea each, and the reader pages through with arrows — on our
own site and, with the identical images, as a LinkedIn carousel.

---

## What we studied, and what we could not see

The brief pointed at a LinkedIn carousel (a Chapter ad aimed at EHPA members).
**The post itself is behind LinkedIn's login wall — it could not be fetched.**
What follows is read off the screenshots the owner supplied plus the
conventions those decks share. If a future reference should be matched more
closely, screenshots of its cards are the input that makes that possible.

From the screenshots, the pattern was consistent and worth copying:

| Observed | What we took |
|---|---|
| Portrait cards, roughly 4:5, two visible side by side in the desktop feed | **4:5 (1254×1568 → 2508×3136)** is the deck default |
| Circular ‹ › arrows on the card edges | arrows on our own reader too, plus swipe and arrow keys |
| A one-line caption UNDER each card | `caption` per card, written at render time into `<slug>-captions.txt` |
| Card 1: brand strip, big headline over a ground | our cover card: market label, headline, sub, key figures |
| Card 2: dark ground, headline, three icon+bold+muted rows | the new **`chips`** block |
| Card 3: a grid of small tiles with status badges | our existing `checks` / `compare` / `table` blocks |
| Card 4: one huge number and an offer box | the new **`cta`** block, with a QR because a carousel is not clickable |
| Stock photography throughout | **not taken.** Our cards are data furniture on the market's own palette; a stock photo would make them read as an ad rather than as a source. |

---

## The format

**Canvas** `4:5` = 1254×1568, rendered at 2× (2508×3136).
`1:1` = 1254×1254 stays available for the square feed and is what every card
published before this is.

**Length** 3–5 cards. Below three there is no reason to swipe; above five the
drop-off makes the last card pointless.

**Card roles** — one idea per card, in this order:

1. **cover** — the headline and the figure the story is about. Never more than
   three figures; they are laid out as three ROWS in portrait (a square's three
   columns break every number across two lines at 4:5).
2. **caveat / evidence** — what the number is not, or what stands behind it.
   `chips` is the workhorse here.
3. **context** — the second dimension: who carries it, what it costs, what
   changes. `stats`, `compare`, `timeline`, `table`.
4. **cta** — one number the reader leaves with, the address as text, and a QR.

**Frame** — unchanged brand furniture on every card: market-tinted ground, side
rail with the domain, flag badge, month, footer lockup. Added for decks: the
position dots and, on card 1 only, a swipe hint — both inside the footer row so
they never sit on top of the content.

**Words** — headline ≤ 2 lines, sub ≤ 1 line, one number per idea. If a card
needs a paragraph it is not a card; it belongs in the article under it.

---

## Making one

```
data_sources/market_trends/decks/<cc>-<slug>.deck.json
```

```jsonc
{
  "slug": "de-2026-09-halbjahr-deck",
  "country": "DE", "countryLabel": "Deutschland", "month": "SEPTEMBER 2026",
  "footer": "HeatPump DB Germany Editorial Team",
  "ratio": "4:5",                 // or "1:1"
  "swipeHint": "weiterblättern",  // card 1 only
  "cards": [
    { "title": ["…", "…"], "sub": "…", "caption": "…", "motif": "chart",
      "sections": [ /* the block vocabulary — see trends-card-blocks.mjs */ ] }
  ]
}
```

Everything the cards share (country, month, footer) is written once and
inherited; a card overrides what it needs.

```bash
node scripts/build-trends-deck.mjs data_sources/market_trends/decks/<name>.deck.json
```

Writes, next to the existing card images:

* `<slug>-1.png … -N.png` — 2× masters
* `<slug>-captions.txt` — the per-card lines, in order, to paste when uploading
* `<slug>-carousel.pdf` — one card per page, for the LinkedIn document post

The renderer refuses quietly to hide a mistake: a card whose content overflows
its frame is named on stderr **before** any file is written, because a deck
with a clipped third card is worse than no deck.

---

## Publishing

**Site** — add `images: ["<slug>-1.webp", …]` next to the existing `image` in
`<CC>.json`. `image` stays: it is the feed thumbnail and the share preview.
The in-app reader (`TrendsPage`) pages through `images` with arrows, keyboard
and swipe; an entry without `images` renders exactly as before.

**LinkedIn** — upload `<slug>-carousel.pdf` as a *document* post (composer →
`+` / more → Add a document), or the PNGs as a multi-image post if the document
option is unavailable. Paste the captions in order. The link in the post text
carries `?ref=li`, and the QR on the last card carries it too — a carousel
itself is not clickable.

---

## One source, still

The frame lives in `scripts/lib/trends-card-frame.mjs` and is shared by the
single-card renderer and the deck renderer. It was extracted from
`build-trends-card.mjs` on 2026-09-11 and the extraction was verified by
re-rendering an existing spec and comparing the PNG byte for byte — the frame
a deck draws and the frame a card draws are the same code, not two copies that
agree today.
