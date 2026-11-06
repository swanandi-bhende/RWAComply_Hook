# Free HTML product landing page template with scroll animations and no libraries

Product landing page template: a free one-page HTML site for launching a physical device, from the hero to two priced finishes, a FAQ and a contact form. The demo is a smart-home remote in soft tactile grey, drawn in HTML and CSS. Its scroll motion runs on CSS with no JavaScript libraries, in one file of about 30 KB gzipped, with an AGENTS.md for Claude Code, Cursor or Codex.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE) ![one HTML file: no build](https://img.shields.io/badge/one%20HTML%20file-no%20build-orange) ![dependencies: none](https://img.shields.io/badge/dependencies-none-brightgreen)

**[Live demo](https://8bsite.github.io/product-landing-page-template/)** · **[Use this template](https://github.com/new?template_name=product-landing-page-template&template_owner=8bsite)** · **[Download ZIP](https://github.com/8bsite/product-landing-page-template/archive/refs/heads/main.zip)** · **[Template page on 8b.com](https://8b.com/templates/hushkey/)**

<a href="https://8bsite.github.io/product-landing-page-template/"><img src="previews/desktop.png" alt="Product website template: first screen on a desktop" width="76.1%"></a> <a href="https://8bsite.github.io/product-landing-page-template/"><img src="previews/phone.png" alt="Product website template: first screen on a phone" width="21.9%"></a>

<p align="center"><a href="https://8bsite.github.io/product-landing-page-template/"><img src="previews/scroll.gif" alt="Product website template: scrolling through the first sections" width="40%"></a><br><sub>Scroll animation</sub></p>

## Use it with Claude Code, Cursor or Codex

Download the four files into your project folder (`curl.exe` in Windows PowerShell):

```bash
curl -LO https://raw.githubusercontent.com/8bsite/product-landing-page-template/main/index.html
curl -LO https://raw.githubusercontent.com/8bsite/product-landing-page-template/main/AGENTS.md
curl -LO https://raw.githubusercontent.com/8bsite/product-landing-page-template/main/LICENSE
curl -LO https://raw.githubusercontent.com/8bsite/product-landing-page-template/main/CREDITS.md
```

Then fill in the angle brackets and give your agent this prompt:

```text
Read AGENTS.md, then edit index.html. Turn this template into the launch page for <my product, who buys it, price per finish, ship date or waitlist, specs, terms, contacts, order URL>. Replace first the product name, price, ship date, key labels, the four mode captions, the three chords and the finish names. Motion is CSS scroll-driven animation plus the inline motion kit: keep the gate script in the head, the section ids, the data-8b-section and data-8b-motion attributes, the classes AGENTS.md lists, each mode item's data-dir, and hero followed by states; add no animation library. Never invent specs, prices, dates, reviews or contacts; ask me.
```

Vibe coding with this product launch website template for Claude Code, Cursor or Codex starts with a fact sheet from the maker: product name, price per finish, bundle price, ship date, battery life, compatibility, payment and returns terms, studio town and contacts. The demo versions of all of these are invented, so the agent should ask for each one and never guess a spec. Then relabel the toggle keys, the four mode captions and the three chords with your product's own functions. Leave the ids, the gate script in the head and the classes AGENTS.md lists in place, and set the footer wordmark's --len number to its new character count.

No agent? Click **[Use this template](https://github.com/new?template_name=product-landing-page-template&template_owner=8bsite)**, edit `index.html` on GitHub and turn on **Settings > Pages**.

## Sections and motion

- **Navigation**: top bar: wordmark, section links, Pre-order button; phone menu overlay.
- **First screen**: first screen: headline, two buttons, the eleven-key product panel drawn in HTML/CSS. Mouse-wheel scrolling is smoothed page-wide and section headings press into the surface as they arrive. On load the headline lines settle and the keys swell in, and pressed dents circle the pad's arrows and slide along the two-key switch while the hero is in view. Scrolling on sinks and shrinks the drawn panel while its keys press one by one.
- **Up is ready. Down is on.**: keyboard of seven toggle keys and an All off key (Up is ready / Down is on). Tied to scroll, the eight keys grow into place in a diagonal wave; a click toggles a key up or down, and All off lifts the rest.
- **One pad. Four moods of the house.**: sticky stage: D-pad drives four room photos (Morning, Desk, Evening, Away). Held in place while you scroll, the pad presses each direction in turn and each next room's photo wipes in from the same side.
- **Hold plus. The light arrives slowly.**: fader + plus key over one room photo (grey to colour on scroll). Tied to scroll, the room photo brightens from dark greyscale to full colour as the fader thumb travels to full and the plus key stays held down.
- **No screen to wake.**: short statement: no screen, no app. Each of the three big lines presses into the surface as it arrives, and the Off tick beside it draws down.
- **Press two at once. Get a third.**: two keys meet and their outlines melt into one (chords). Held in place while you scroll, the Lamp and Lock keys glide together while their outline, redrawn as you scroll, melts into one shape; then both press and Goodnight fades up.
- **Made to be found in the dark.**: three material cards with texture photos. The three photos rise out of their wells a beat apart, and the tick lines above them draw down.
- **Two finishes. The same eleven keys.**: two finishes (Chalk, Graphite) with pre-order buttons and a switch. Each finish panel tilts upright from a steep backward lean as it scrolls in; at the section's end a single key presses down.
- **Before you press order.**: questions and answers (native &lt;details&gt;). The graphite background floods out of that key in a widening circle, tied to scroll, and the questions rise in.
- **Ask someone who has pressed every key.**: email, phone and a contact form (placeholders).
- **Footer**: width-filling HUSHKEY wordmark, links, copyright and the Design: 8B credit. Tied to scroll, the width-filling wordmark presses in letter by letter, each letter brightening from muted grey as its shadow flips.

## Design

![#e4e5e8](https://img.shields.io/badge/-%23e4e5e8-e4e5e8?style=flat-square) page background, key faces  
![#232427](https://img.shields.io/badge/-%23232427-232427?style=flat-square) body text, shadows  
![#fbfbfc](https://img.shields.io/badge/-%23fbfbfc-fbfbfc?style=flat-square) highlights on keys and headings  
![#8d8e93](https://img.shields.io/badge/-%238d8e93-8d8e93?style=flat-square) hairline outlines and contour lines  
![#55565b](https://img.shields.io/badge/-%2355565b-55565b?style=flat-square) embossed headings  
![#b4b5b9](https://img.shields.io/badge/-%23b4b5b9-b4b5b9?style=flat-square) upper edge of the hero gradient  
![#2c2d31](https://img.shields.io/badge/-%232c2d31-2c2d31?style=flat-square) graphite FAQ, contact and footer bands  
![#a9abb0](https://img.shields.io/badge/-%23a9abb0-a9abb0?style=flat-square) muted text on graphite  
![#121315](https://img.shields.io/badge/-%23121315-121315?style=flat-square) deep shadows under graphite keys, buttons and headings

**Mozilla Headline**: headings: condensed, bold, very large, embossed. **Mozilla Text**: body and labels; small captions in spaced capitals (Google Fonts). Soft monochrome neumorphism: keys, buttons and photo frames rise from or press into one cool grey surface, and headings look stamped into it. The device is drawn in HTML and CSS from round keys and a rotated diamond, with SVG contour lines. Material photos are cut as a pill, a circle and a square.

## Questions

**What is a product landing page, and is this one built for hardware?**  
It is a page that presents one product and leads to one action, such as a pre-order or a waitlist sign-up. This one is built for a physical device: a hero, six sections that each show one idea, two priced finishes, six FAQ answers and a contact form, all on one [long scrolling page](https://8b.com/templates/one-page/).

**How to create a waitlist landing page from this template?**  
Point the Pre-order buttons at your sign-up form or waitlist service. The nav and hero buttons scroll to the finishes now, and the two finish buttons scroll to the contact form. Then replace the price and the ship date, and connect the contact form to Formspree or Netlify Forms, or remove it.

**Does the contact form send messages?**  
No. The form checks that the name, email and message are filled in and the email looks valid, then shows a thank-you line and sends nothing. Connect Formspree or Netlify Forms, or remove the form with its script and keep the email link. Also edit the promised reply within a working day, which is demo text.

## Is it the right base?

Pick this base when you sell a physical product and can explain it in a handful of ideas, each with its own section. This is the light build: the same look and scroll behaviour for the visitor, with no animation library and no script from a CDN. It downloads about 30 KB of code gzipped in one file; the GSAP version needs 76 KB and four more requests. For software, such as a SaaS product landing page, the [app](https://8b.com/templates/linea/) template is nearer. The weak spot is the hero: several animations press its round keys, so a speaker or lamp means redrawing the panel. There is no cart or checkout.

## Before you publish

- Replace what is marked `data-8b-placeholder` (social preview image, favicon, email, phone, form) and the invented demo facts; [AGENTS.md](AGENTS.md) lists them.
- The form sends nothing yet: connect it to Formspree or Netlify Forms, or remove it.

## Tech

No JavaScript libraries: CSS scroll-driven animations and a small inline motion script with its own smooth wheel scrolling, 126 KB, no build step. Chrome and Edge 111+, Safari 16.2+, Firefox 113+ (it uses color-mix(), container query units, cascade layers, small/dynamic viewport units). Without scroll-driven animations (Firefox today) the scroll motion and the smooth wheel are off and each section shows its finished layout, while any load-in or looping animation still plays; with "reduce motion" on, the page is complete and nothing moves on its own (hover effects stay).

A GSAP build of the same page is [`index.gsap.html`](index.gsap.html): GSAP 3.13.0, ScrollTrigger, SplitText, Lenis 1.3.27 from jsDelivr, 117 KB; its scroll motion also plays in Firefox. Use one of the two files.

## License

MIT, see [LICENSE](LICENSE). Photos, fonts and libraries keep their own licences: [CREDITS.md](CREDITS.md). More free templates: [8b.com/templates](https://8b.com/templates/) · [github.com/8bsite](https://github.com/8bsite).
