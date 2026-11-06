---
version: alpha
name: "Product landing page template by 8B"
description: "Product launch page for a physical smart-home pad in soft monochrome neumorphism: cool grey keys that press into one surface. Free HTML template by 8B, MIT."
colors:
  primary: "#232427"
  secondary: "#55565b"
  tertiary: "#8d8e93"
  surface: "#e4e5e8"
  on-surface: "#232427"
  highlight: "#fbfbfc"
  hero-edge: "#b4b5b9"
  graphite: "#2c2d31"
  graphite-deep: "#121315"
  graphite-muted: "#a9abb0"
typography:
  headline-hero:
    fontFamily: Mozilla Headline
    fontSize: 116px
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: -0.005em
  headline-display:
    fontFamily: Mozilla Headline
    fontSize: 92px
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: -0.005em
  headline-md:
    fontFamily: Mozilla Headline
    fontSize: 34px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.005em
  body-lg:
    fontFamily: Mozilla Text
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.45
  body-md:
    fontFamily: Mozilla Text
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.55
  body-sm:
    fontFamily: Mozilla Text
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.5
  label-caption:
    fontFamily: Mozilla Text
    fontSize: 13px
    fontWeight: 300
    lineHeight: 1.4
    letterSpacing: 0.42em
  label-md:
    fontFamily: Mozilla Text
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0.08em
  button:
    fontFamily: Mozilla Text
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.02em
rounded:
  md: 26px
  lg: 34px
  full: 999px
spacing:
  section: 176px
  gutter: 48px
  max-width: 1280px
  column-gap: 56px
  key-gap: 30px
  hairline: 1.5px
components:
  button-primary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: 0 30px
    height: 54px
  button-graphite:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: 0 30px
    height: 54px
  key-round:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.full}"
    size: 4.6em
  key-square:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 18px
  card-raised:
    backgroundColor: "{colors.highlight}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
  photo-frame:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: 10px
  faq-item:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
  input-field:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: 15px 22px
    height: 56px
---

## Overview

Hushkey is a pre-order page for a physical device: a calm wall pad with round keys that controls the lights, blinds and music of a house. The one idea is soft monochrome neumorphism. Everything, the keys, buttons, photo frames and the device itself, rises out of or presses into a single cool grey surface, and headings look stamped into it. The only colour comes from the room photographs. It speaks to people who want technology to feel quiet and tactile, and the mood is hushed, precise and slightly luxurious.

## Colors

A cool grey scale with one dark graphite band. No hue.

- **Surface (#e4e5e8):** the page background and the key faces; every raised or pressed thing is made of this.
- **Primary / on-surface (#232427):** body text, and the base colour of the shadows.
- **Highlight (#fbfbfc):** the light edge on keys, headings and cards, and the top of every raised gradient.
- **Secondary (#55565b):** embossed headings and small captions.
- **Tertiary (#8d8e93):** hairline outlines, contour lines and key labels.
- **Hero edge (#b4b5b9):** the upper end of the hero's vertical gradient.
- **Graphite (#2c2d31):** the FAQ, contact and footer bands, graphite keys, buttons and form fields.
- **Graphite deep (#121315):** the deep shadows under graphite keys and buttons.
- **Graphite muted (#a9abb0):** secondary text on graphite and the unlit letters of the footer wordmark.

## Typography

- **Mozilla Headline** at 700, condensed (font-stretch 75%): all headings and the nav wordmark. Sentence case, line height 0.9, almost no tracking. The hero headline scales up to 116px, other headings 48px to 92px. Headings are set in the embossed #55565b with a light edge below and a dark edge above, so they look pressed in. Headings on graphite are pale (#e4e5e8) with a faint light edge below and a deep dark edge above.
- **Mozilla Text** (300 to 600): body at 17px, the lede at 20px, notes at 15px. Small captions are uppercase and widely spaced: 13px light at 0.42em under the hero headline, 13px semibold at 0.08em for labels and form fields.
- Prices and small headings use the condensed face at 34px to 44px.

## Layout

A 1280px wrapper with a gutter of 16px to 48px. Sections are padded 104px to 176px top and bottom and mostly use asymmetric two-column grids (5 to 7, 6 to 5) with a 56px gap; the heading and a short lede sit on one side, the device or photo on the other. The hero puts the headline beside a drawn panel that is sized in em, so the whole device scales with the font size. At 899px and below everything stacks in one column, the nav becomes a menu overlay, and the key grids drop from four to two columns. Material photos are staggered at different heights.

## Elevation & Depth

Depth is the whole style, made with layered shadows sized in em so they scale with each element.

- **Raised:** a soft drop shadow below, a tight contact shadow, a 1px highlight inset on top and a faint inset darkening at the bottom. Keys and buttons also have a top-to-bottom gradient from highlight to surface.
- **Pressed:** an inset shadow at the top and a highlight inset at the bottom, on a gradient that is slightly darker at the top. Used for the dent of a pressed key, photo frames and the fader groove.
- **Card:** a large soft shadow (0 18px 40px, negative spread) with a highlight line on top.
- **Graphite:** the same recipes with deep shadows and a faint light edge.
- **Engraved text:** a 2px highlight below and a 1px dark line above the letters.

Never use a coloured shadow or a hard offset shadow.

## Shapes

Keys are circles. Product tiles and FAQ items are rounded squares (26px); photo frames and cards use 34px; buttons, fields and the floating nav bar are full pills (999px). Photos in the materials row are cut as a tall pill, a circle and a square. The device is drawn in HTML and CSS: round keys around a rotated diamond outline (1.5px line), a segmented switch, a fader, with SVG contour lines. Rules and outlines are 1.5px, in #8d8e93 on the light surface.

## Components

- **button-primary:** a raised pill, 54px tall; on hover its dent fades in and the label sinks 1px, when pressed 2px.
- **button-graphite:** the same pill in graphite, light text.
- **key-round / key-square:** a cap and a dent layer; a pressed key fades in its dent, and presses driven by scrolling also shrink the cap to 0.965.
- **card-raised:** the raised surface of the nav bar and of the captions that overlap the room photos.
- **photo-frame:** 10px of surface around the image, pressed in.
- **faq-item:** a raised graphite slab with a small plus key that turns to a minus.
- **input-field:** a dark pressed pill on graphite with 16px text and a pale label above.
- Links have a 1px underline that thickens to 3px on hover.

## Motion

The page uses no animation library and no script from a CDN. Scroll-tied motion is CSS scroll-driven animation (`animation-timeline` on view timelines) with sticky stages; a gate script in the head sets `data-8b-live` on the root only when the browser supports scroll-driven animations and reduced motion is off, and every scroll effect is scoped under it. A small inline motion kit at the end of the body plays the entrances, measures a few distances into CSS variables and smooths mouse-wheel scrolling. The motion idea is a press: parts of the interface sink into the surface, one key at a time.

- **Headings:** each section heading debosses as it arrives, the shadow flips from raised to engraved over 0.9s (`data-8b-motion="deboss"`). Photos, FAQ items and form fields rise from 0.9 scale (1s, `rise`). SVG outlines draw themselves (1.1s) and tick lines grow down (0.7s, `contour`). Entrances start when an element reaches 88% of the viewport height.
- **Hero:** on load, in CSS, the headline lines settle and the keys swell in; a pressed dent circles the pad's arrows and another moves across the segment switch in loops, paused while the hero is off screen. Scrolling on shrinks the drawn panel to 0.82 as it sinks toward the next section while its keys press one by one; the sink depth is measured so the panel stops above the first row of key outlines.
- **States:** eight keys grow into place in a diagonal wave; a click presses or lifts a key, All off lifts the rest.
- **Modes:** a 340vh track with a sticky stage; the pad presses each direction in turn, and the next room's photo wipes in from that side.
- **Dimmer:** the room photo brightens from dark greyscale to full colour as the fader thumb travels and the plus key stays held.
- **Quiet:** the three big lines deboss and the small Off ticks beside them draw in.
- **Chords:** a 250vh track with a sticky stage; two keys glide together while a short script redraws their outline from their positions so it melts into one shape, then both press and the result fades up.
- **Editions:** each finish panel tilts upright from a steep backward lean; a single key presses down at the end.
- **FAQ:** the graphite background floods out of that key in a widening circle (a clip-path circle measured from the key's centre), then the questions rise.
- **Footer:** the wordmark is split into letters that press in one by one, each brightening from muted grey as its shadow flips.

Without scroll-driven animation support (Firefox today) the page shows its finished static layout with ordinary scrolling: the modes as a 2 by 2 grid of photo cards, the chord keys already joined and pressed in one outline, a plain graphite FAQ ground; only the hero's load-in and looping dents still play. With reduced motion on, those stop too and the page reads in full as a static layout; hover and press transitions remain.

## Do's and Don'ts

- Do build every element from the one surface colour with raised and pressed shadows.
- Do keep the palette grey; let the room photographs carry any colour.
- Do emboss headings with the light-and-dark edge pair.
- Do keep corners round: circles for keys, 26px to 34px for panels, pills for buttons.
- Do use thin 1.5px outlines for contours and slots.
- Don't add accent colours, gradients with hue, or coloured glows.
- Don't use flat outlined buttons or hard offset shadows.
- Don't set headings in a light weight or wide face.
- Don't add stock icons; the keys carry simple filled glyphs.
