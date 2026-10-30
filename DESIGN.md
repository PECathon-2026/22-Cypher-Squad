# Small Web Reader — Design System Specification

## 1. Aesthetic Character & Emotional World
Small Web Reader embodies the character of a quiet, sunlit private library: an unhurried, tactile editorial space designed for thoughtful reading. It eschews dashboard clutter, flashing alerts, high-saturation accents, and aggressive contrast in favor of:
- **Warm Uncoated Paper**: Soft, low-glare surface backgrounds that simulate physical book paper.
- **Deep Printing Ink**: Rich black-green ink typography with high literary legibility.
- **Natural Organic Accents**: Weathered sage greens, autumnal ochres, and terracotta clays.
- **Dual-Engine Typography**: Literary high-contrast serif headlines for editorial gravitas, paired with quiet, humanist sans-serif for metadata and controls.
- **Tactile Boundaries**: Delicate hairlines (`rgba(24, 34, 31, 0.13)`), subtle tone-on-tone container nesting, and zero heavy drop shadows.

---

## 2. Color Palette & Token Architecture

| Token Name | Hex / CSS Value | Semantic Role |
| :--- | :--- | :--- |
| **Ink** | `#18221f` | Primary body text, article headlines, solid dark button fills |
| **Muted** | `#6f7871` | Secondary metadata, timestamps, author lines, helper captions |
| **Paper** | `#f5f1e8` | Main application background, warm natural page base |
| **Paper Deep** | `#ebe5d8` | Selected navigation pills, secondary buttons, active container fills |
| **Sage** | `#9eb4a3` | Positive statuses (`synced`), privacy assurance badges, live sync dots |
| **Ochre** | `#d7a646` | Attention indicators, unread queue highlights, discover accents |
| **Clay** | `#c97058` | Offline alerts, error notifications, destructive actions (`Unfollow`) |
| **Mist** | `#dde3dd` | Timeline rails, secondary dividers, subtle tag backgrounds |
| **White** | `#fcfaf4` | Editorial post cards, modal containers, input backgrounds |
| **Line / Border** | `rgba(24, 34, 31, 0.13)` | Delicate architectural hairlines, card borders, list dividers |

---

## 3. Typography Hierarchy

### Typefaces
- **Display & Editorial**: `Fraunces` (Serif) — used for brand wordmarks, page titles, article headlines, pull quotes, and editorial section breaks.
- **Utility & Interface**: `DM Sans` (Sans-Serif) — used for navigation links, metadata badges, timestamps, button labels, forms, and technical telemetry.

### Type Scale & Rhythm
- **Hero Title**: `Fraunces`, 32px / 40px, font-weight 600, letter-spacing `-0.02em`
- **Headline Large**: `Fraunces`, 24px / 32px, font-weight 600, letter-spacing `-0.015em`
- **Headline Medium / Post Title**: `Fraunces`, 20px–22px / 28px, font-weight 600, letter-spacing `-0.01em`
- **Article Body**: `Fraunces` / `DM Sans`, 16px–18px / 28px, max line-length ~65ch
- **Interface Body**: `DM Sans`, 14px / 22px, font-weight 400
- **Metadata & Captions**: `DM Sans`, 12px / 18px, font-weight 400
- **Eyebrows & Badges**: `DM Sans`, 11px / 16px, font-weight 600, uppercase, letter-spacing `0.05em`

---

## 4. Layout & Spacing Architecture

### Desktop Layout (Two-Column Fixed Grid)
- **Fixed Left Sidebar (248px)**:
  - Brand lockup: Dark ink tile with feather emblem + `small web reader` wordmark + `a quiet queue for the open web`.
  - Room Navigation: `Timeline` (with unread badge), `Subscriptions`, `Discover`, `Settings`.
  - Bottom Utility: Local privacy assurance (`Your reading state stays on this device`) + Connection status pill (`Online · synced` / `Offline · cached`).
- **Main Reading Deck**:
  - Centered reading column constrained to 720px–760px for optimal scanning and reading cadence.
  - Generous vertical whitespace (`py-10` to `py-12`, `px-8` to `px-12`).

### Mobile Layout
- Compact sticky top header (48px) with menu drawer toggle, centered wordmark, and connection status indicator.
- Single-column flowing reading queue with tactile full-width touch cards.

---

## 5. Screen Manifest & Google Stitch Designs

All screens have been modeled and rendered within Google Stitch project **`projects/1055352040201508135`** using design system asset **`assets/9b14c2193cc741abb2cfcf6fe22a8b05`**:

1. **Timeline Screen (Desktop View)**
   - *Screen ID*: `a54207b9a31e4ee0b7c2266f10d4ea2d`
   - *Route*: `/`
   - *Features*: Fixed 248px sidebar with unread counter (12), editorial header *“Make room for good things.”*, filter toolbar (All feeds, Unread only), editorial post rows with colored status markers (sage, ochre, clay), read attenuation, and tactile footer controls.

2. **Subscriptions Management Screen (Desktop View)**
   - *Screen ID*: `ceb36846f1c941d78652b22f011fd7fc`
   - *Route*: `/subscriptions`
   - *Features*: URL follow form with inline validation feedback, feed list rows with status dots (`synced`, `attention`, `malformed`), saved post counts, and unfollow triggers.

3. **Discover Screen (Desktop View)**
   - *Screen ID*: `c6d6084b93e544c5b49a0f0cf0007756`
   - *Route*: `/discover`
   - *Features*: Sage-tinted privacy strip explaining transient URL sharing, recommendation cards with left color swatches, transparent recommendation rationales, signal scores, and the opt-in community contribution panel.

4. **Focused Article Reader (Desktop View)**
   - *Screen ID*: `ff68d962f7b543a4ba5a10322ef954b9`
   - *Route*: `/read?post=slow-tools`
   - *Features*: Distraction-free 65ch reading column, offline `Saved copy` indicator, Fraunces serif headline and standfirst deck, editorial pull quote, source link, and contextual *Blogs like Moss & Signal* recommendation cards.

5. **Settings & Preferences Screen (Desktop View)**
   - *Screen ID*: `ab5240a46b494cb9816934cbe65beced`
   - *Route*: `/settings`
   - *Features*: Tactile settings rows for Offline reading, Local cache (with *Clear cache* action), Anonymous discovery toggle, and prominent *What never leaves this device* privacy card.

6. **Add Feed Modal Dialog State (Desktop View)**
   - *Screen ID*: `8b68dc4b57d54dcd892a4a7b99a440ca`
   - *Route*: Modal overlay on `/`
   - *Features*: Dark translucent paper scrim (`rgba(24, 34, 31, 0.45)` with blur), centered 540px parchment card, globe input with autodiscovery note, validation preview, and ink action button.

7. **Mobile Timeline Screen (Mobile View - 390px)**
   - *Screen ID*: `ffcc50d4b5164a8f8625087988122561`
   - *Route*: Mobile viewport on `/`
   - *Features*: Compact sticky header, thumb-friendly touch targets, responsive post feed cards, and offline sync indicator.
