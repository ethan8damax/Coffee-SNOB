---
name: Coffee Snob
description: A curated specialty coffee locator, in build — one shop, one roaster, one Sunday letter.
colors:
  paper: "#f0ecdf"
  paper-2: "#e6e1d1"
  cream: "#e9e4d0"
  card: "#faf8ef"
  ink: "#161310"
  ink-2: "#4b423a"
  ink-3: "#8c8175"
  oxblood: "#4a1206"
  oxblood-lt: "#63200e"
  burnt: "#c46a17"
  sage: "#9cb6b8"
  sage-dk: "#86a4a6"
  sage-lt: "#b6c9ca"
  teal: "#0e8ba3"
  teal-dk: "#0a6272"
typography:
  display:
    fontFamily: "'Area', -apple-system, system-ui, sans-serif"
    fontSize: "clamp(52px, 7vw, 112px)"
    fontWeight: 700
    lineHeight: 0.87
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "'Area', -apple-system, system-ui, sans-serif"
    fontSize: "clamp(34px, 3.6vw, 54px)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.038em"
  title:
    fontFamily: "'Area', -apple-system, system-ui, sans-serif"
    fontSize: "clamp(24px, 2vw, 30px)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
  lede:
    fontFamily: "'Area', -apple-system, system-ui, sans-serif"
    fontSize: "17.5px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.012em"
  body:
    fontFamily: "'Area', -apple-system, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.008em"
  label:
    fontFamily: "'Area Extended', 'Area', sans-serif"
    fontSize: "8.5px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.14em"
rounded:
  flat: "2px"
  sm: "4px"
  md: "8px"
  lg: "14px"
spacing:
  xs: "8px"
  sm: "18px"
  md: "28px"
  lg: "56px"
  xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.burnt}"
    textColor: "{colors.ink}"
    rounded: "{rounded.flat}"
    padding: "0 18px"
    height: "46px"
  button-accent:
    backgroundColor: "{colors.oxblood}"
    textColor: "{colors.cream}"
    rounded: "{rounded.flat}"
    padding: "0 18px"
    height: "46px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.flat}"
    padding: "0 18px"
    height: "46px"
  chip-default:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.flat}"
    padding: "0 11px"
    height: "27px"
  chip-oxblood:
    backgroundColor: "{colors.oxblood}"
    textColor: "{colors.cream}"
    rounded: "{rounded.flat}"
    padding: "0 11px"
    height: "27px"
  input-email:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.flat}"
    padding: "0 16px"
    height: "52px"
---

# Design System: Coffee Snob

## 1. Overview

**Creative North Star: "Editorial, not decorative."**

Coffee Snob's web presence reads like a well-run print newsletter that happens to be a website: warm paper background, disciplined type, almost no ornament. Every visual choice earns its place by carrying information — a chevron fill shows effort level, a color band marks a section transition, a hairline rule separates content. Nothing is decorative for its own sake. This mirrors the product's own standard: a shop write-up is disqualified if the detail "could describe a different shop"; a page is disqualified if a visual flourish could be swapped out without losing meaning.

The palette is a warm, worn paper world (paper, cream, card) punctuated by two hard-working accents: oxblood for the highest-conviction moments (footer, top ratings, primary links) and burnt orange for warmth and action (buttons, emphasis, mid-tier ratings). Sage appears once as a calm background band, never as a UI accent. There are no shadows anywhere in the system — depth comes from full-bleed color blocks and hairline rules, never elevation tricks.

Typography carries the brand's confidence: Area for reading, Area Extended (heavy, uppercase, tracked) for anything that needs to sound certain — labels, buttons, kickers. The display type is large and tight (negative tracking down to -.045em), giving headlines a compressed, printed-poster feel rather than a soft SaaS one.

This system explicitly rejects: numeric or star ratings anywhere in the UI (the five-chevron effort scale is the only rating system — see the Detour Scale rule below), affiliate-blog visual clichés (badge clusters, "top 10" numbered overlays, urgency banners), glassmorphism as decoration (the one blur — the sticky nav — is functional, not aesthetic), and gradient or gimmicky treatments on type.

**Key Characteristics:**
- Warm paper base, near-black warm ink text, zero pure grays
- Two accent colors doing all the emotional work: oxblood (gravity) and burnt (warmth/action)
- Flat, sharp-cornered surfaces (2px radius) — nothing pill-shaped, nothing soft
- Area Extended uppercase-tracked type for anything structural (nav, labels, buttons, kickers)
- No shadows; depth via full-bleed color bands and hairline rules only
- Chevron-based effort rating as a first-class, recurring visual motif — never a number

## 2. Colors

A warm-paper editorial palette: three warm neutrals for surface and text, two committed accents, and one quiet secondary hue used exactly once as a background band.

### Primary
- **Burnt Amber** (`#c46a17` / `--burnt`): the working accent. Emphasis inside headlines (the `<em>` in the hero H1), button fills, hover states on links and nav, mid-tier chevron fill ("Make the trip"), kicker text on the letter band.

### Secondary
- **Oxblood** (`#4a1206` / `--oxblood`): the high-conviction color. Footer background, top-tier chevron fill ("Catch a flight"), primary text links and "see all" affordances, the letter-band signature block. Used far less often than burnt — its rarity is what makes it read as the highest signal.

### Tertiary
- **Dusty Sage** (`#9cb6b8` / `--sage`): a single quiet background band (the city list strip beneath the hero) and the default photo-placeholder fill. Never used as text or as a UI accent — it's a resting color, not an active one.

### Neutral
- **Warm Paper** (`#f0ecdf` / `--paper`): page background.
- **Aged Cream** (`#e9e4d0` / `--cream`): secondary warm surface — footer/CTA text-on-dark, script logo on dark backgrounds.
- **Card White** (`#faf8ef` / `--card`): the lightest neutral, reserved for card/content surfaces that need to lift slightly off the paper background without a shadow.
- **Warm Ink** (`#161310` / `--ink`): primary text and the near-black anchor of the whole palette — never pure black.
- **Ink Muted** (`#4b423a` / `--ink-2`): body copy, secondary text.
- **Ink Faint** (`#8c8175` / `--ink-3`): tertiary text — captions, counts, disabled-feeling labels.
- **Signal Teal** (`#0e8ba3` / `--teal`, darker `#0a6272` / `--teal-dk`): default link color only. Reserved strictly for inline text links; never used as a surface or button fill.

### Named Rules
**The Two-Accent Rule.** Only oxblood and burnt carry emotional weight. If a third "accent" color starts appearing on interactive elements, that's drift — route it back to one of the two, or to neutral.

**The No-Number Rule.** No UI element may render a numeric score, a star rating, or a decimal average. Rating is always the five-chevron effort scale (`↑` to `↑↑↑↑↑`), rendered via the `Detour` component. This is the single most important rule in the system — it's brand identity, not styling.

## 3. Typography

**Display Font:** Area (with -apple-system, system-ui, sans-serif fallback)
**Label/Structural Font:** Area Extended (bold 700 / black 900, always uppercase, always tracked)

**Character:** One family carrying two very different jobs. Area in regular weight reads quietly for body copy; Area Extended in black weight, uppercase, and heavily tracked (+0.1–0.14em) is reserved for anything that needs to sound like an instruction or a fact — nav, labels, buttons, kickers, chevron captions. The contrast between the two is the entire typographic system; there's no third typeface.

### Hierarchy
- **Display** (700, `clamp(52px, 7vw, 112px)`, line-height 0.87, tracking -0.045em): the hero H1 only. `<em>` inside it (not italic — recolored burnt) marks the one word that matters.
- **Headline** (700, `clamp(34px, 3.6vw, 54px)`, line-height 0.95, tracking -0.038em): section heads (letter band, page heads).
- **Title** (700, `clamp(24px, 2vw, 30px)`, line-height 1, tracking -0.03em): card and journal-entry titles.
- **Lede** (400, 17.5px, line-height 1.5, tracking -0.012em, color ink-2): the one supporting sentence under a display or headline — used sparingly, never more than one per section.
- **Body** (400, 13.5px, line-height 1.45, tracking -0.008em, color ink-2): running copy. Cap at ~65–75ch measure.
- **Label** (Area Extended 700, 8.5px, tracking 0.14em, uppercase; a larger "label-lg" variant at 11px/900-weight exists for emphasis): nav items, chips, kickers, footer column heads, form confirmations.

### Named Rules
**The Two-Register Rule.** A block of text is either reading copy (Area, sentence case, generous line-height) or structural copy (Area Extended, uppercase, tracked, tight line-height). Never blend the two conventions in one text block — no uppercase-and-tracked body paragraphs, no sentence-case nav labels.

## 4. Elevation

Fully flat. There are no `box-shadow` declarations anywhere in the system. Depth is conveyed two ways: full-bleed color bands (sage city strip, burnt letter section, oxblood footer) that shift the whole viewport's background to signal a new "zone," and hairline 1px rules (`--rule`, `rgba(22,19,16,.13)`) that separate content without lifting it. The one softening effect in the entire system is the sticky nav's `backdrop-filter: blur(10px)` over a translucent paper background — functional (keeps nav legible over scrolling content), not decorative, and it's the only blur anywhere.

### Named Rules
**The Flat-By-Default Rule.** No shadows, ever, on cards, buttons, or inputs. If something needs to feel "raised," lift it with the Card White neutral against Warm Paper, not with a shadow.

## 5. Components

### Buttons
- **Shape:** flat, sharp corners (2px radius), height 46px (38px in the compact nav variant), uppercase Area Extended label at 10.5px/900-weight, tracking 0.1em.
- **Primary — `.btn-ox`:** oxblood fill, cream text. The highest-conviction CTA (rare — used once per page, typically the signup submit inside the dark letter band).
- **Secondary — `.btn-bu`:** burnt fill, ink text. The default working button (nav CTA, hero signup).
- **Ghost — `.btn-line`:** transparent fill, 1px ink border, ink text. Used where a button needs to be present but quiet.
- No hover-state color shift is defined beyond link/nav hover (which shifts to burnt); buttons rely on their fill contrast rather than a hover treatment.

### Chips
- **Style:** transparent by default with a 1px `--rule` border, ink-2 text, Area Extended 8.5px uppercase label, 27px height, 2px radius.
- **State:** `.chip.on` inverts to solid ink fill on paper text (a selected/filter state). `.chip.ox` and `.chip.bu` are the oxblood- and burnt-filled variants used specifically for the top two chevron-rating tiers ("Catch a flight" and "Make the trip") — filled chips signal the highest ratings; unfilled/outlined chips are the default and lower tiers.

### Cards / Photo Placeholders
- **Corner Style:** 2px radius, consistent with buttons and inputs — nothing in the system uses a larger radius than 2px.
- **Background:** sage (default), oxblood (`.ox` variant), or paper-2 (`.cr` variant) — the placeholder background communicates context before an image loads.
- **Shadow Strategy:** none (see Elevation).
- **Border:** none on photo placeholders; content cards below them use a 1px `--rule` top border instead of a boxed border, keeping the flat/editorial feel rather than a boxed "card" look.

### Inputs / Fields
- **Style:** transparent background, 1px ink border, 2px radius, 52px height, Area regular 15px text.
- **Focus:** 2px burnt outline, offset -1px (inset-feeling focus ring, not a glow).
- **Dark variant (`.on-dark`):** border and placeholder shift to translucent cream instead of ink, for use inside the oxblood/burnt bands.

### Navigation
- **Style:** sticky top, translucent paper background with 10px backdrop blur, 1px `--rule` bottom border, Area Extended 9.5px uppercase links with 0.13em tracking.
- **States:** default ink-2, hover burnt, active (`.on`) ink with a 2px burnt underline offset 6px below the text.
- **Mobile:** nav links are hidden entirely below 900px (no hamburger drawer implemented yet — logo, sign-in, and CTA remain).

### Detour Chip (signature component)
The five-chevron effort-rating indicator is the brand's most distinctive visual mark: a row of five small chevron strokes, full opacity up to the rating value and faint beyond it. Two forms, chosen by context:
- **Compact chip** (`Detour` component, used in cards/lists — city guide cards, journal metadata): chevrons + effort-scale label together inside a `.chip` pill. Rating value 4 renders in a burnt-filled chip, value 5 in an oxblood-filled chip; values 1–3 render in the default outlined chip.
- **Bare chevrons** (used in the rating-scale legend on the landing page, where an adjacent large title already states the label): chevrons alone, no pill, no duplicate text — color shifts from muted cream/tan to burnt to mark the row currently being explained, matching the row's number and title color.

## 6. Do's and Don'ts

### Do:
- **Do** keep every rating a chevron effort-scale value (`Detour` component), never a number or star.
- **Do** use flat 2px corners everywhere — buttons, inputs, photo placeholders, cards.
- **Do** reserve Area Extended (uppercase, tracked) for structural text only: nav, labels, buttons, kickers.
- **Do** let oxblood stay rare — it should read as the highest-conviction color precisely because it appears less often than burnt.
- **Do** convey depth with full-bleed color bands and 1px hairline rules, never shadows.
- **Do** write specific, concrete copy per PRODUCT.md's voice — short sentences, opinions as fact, curate/curation/rigorous/picky/snob as the house vocabulary.

### Don't:
- **Don't** introduce a numeric score, star rating, or decimal average anywhere in the UI — the chevron scale is the only rating system, and this is brand identity, not a styling preference.
- **Don't** add box-shadows, drop shadows, or glow effects to any surface. If something needs to feel elevated, use the Card White neutral against Warm Paper instead.
- **Don't** use border-radius above 2px on any interactive element or photo container.
- **Don't** use glassmorphism decoratively — the sticky nav's blur is the one functional exception, not a pattern to repeat.
- **Don't** write or design toward affiliate-blog patterns: numbered "Top 10" badges, urgency banners, star-rating widgets, sponsored-placement styling. PRODUCT.md is explicit that there is "no affiliate padding, ever."
- **Don't** use banned vocabulary in any UI copy: "elevate," "leverage," "streamline," "hidden gem," "vibe," "nestled," or "it's not X it's Y" constructions.
- **Don't** blend the two typographic registers — no uppercase-tracked paragraphs, no sentence-case structural labels.
