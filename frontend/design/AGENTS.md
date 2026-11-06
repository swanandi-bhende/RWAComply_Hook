# AGENTS.md: product landing page template

Product launch and pre-order page for a physical device. One file, `index.html`, with inline CSS and scripts, no JavaScript libraries: the scroll motion is CSS scroll-driven animations plus a small inline motion kit; no build step, and none is needed for copy, colour or photo edits. A GSAP build of the same page is `index.gsap.html` (GSAP 3.13.0, ScrollTrigger, SplitText, Lenis 1.3.27 from jsDelivr): edit one of the two, not both.

## Files
Edit these files, not a page fetched by URL (that arrives as a summary).
```bash
curl -LO https://raw.githubusercontent.com/8bsite/product-landing-page-template/main/index.html
curl -LO https://raw.githubusercontent.com/8bsite/product-landing-page-template/main/AGENTS.md
curl -LO https://raw.githubusercontent.com/8bsite/product-landing-page-template/main/LICENSE
curl -LO https://raw.githubusercontent.com/8bsite/product-landing-page-template/main/CREDITS.md
```
Upload `index.html`, LICENSE and CREDITS.md; not this file, README.md or `previews/`.

## Keep
- Every `id`, `data-8b-section`, `data-8b-motion` and `data-8b-part` (`section:<id>` styles, `scene:<id>` animation).
- The motion parts `motion-gate` (head: sets `data-8b-live` on `<html>` only with scroll-driven animation support and no reduced motion), `motion-kit` and `motion`, and every other `data-8b-*` attribute (`data-8b-items` groups, `data-8b-off`, `data-8b-enter`): the CSS and the kit read them. Items ordered by `--i` follow their group; counts the CSS fixes are listed under Known limits (`data-8b-fixed` marks such a group).
- Selectors the scripts use:
  - `section-script:nav`: `.nav__open` `.nav__close`
  - `section-script:states`: `.m-key-2`
  - `section-script:contact`: `.contact__form` `.contact__status` `data-sent` `data-invalid`
  - `scene-script:hero`: `.hero__stage` `.states__slot`
  - `scene-script:dimmer`: `.dimmer__rig` `.dimmer__groove` `.dimmer__thumb`
  - `scene-script:chords`: `.chords__track` `.chords__art` `.chords__contour`
  - `scene-script:faq`: `.editions__key`
- `style="--len:N"` = characters in that display line, spaces included: `HUSHKEY` is 7.
- The product panel, the keys and the switches are HTML and CSS (with SVG outlines), not images: restyle them through the CSS variables and the .m-key* classes.
- Colours and fonts are variables in `:root` (`data-8b-part="tokens"`): `--color-1` #e4e5e8 (page background, key faces), `--color-2` #232427 (body text, shadows), `--color-3` #fbfbfc (highlights on keys and headings), `--color-4` #8d8e93 (hairline outlines and contour lines), `--color-5` #55565b (embossed headings), `--color-6` #b4b5b9 (upper edge of the hero gradient), `--color-7` #2c2d31 (graphite FAQ, contact and footer bands), `--color-8` #a9abb0 (muted text on graphite), `--color-9` #121315 (deep shadows under graphite keys, buttons and headings); body text needs 4.5:1 contrast.
- With reduced motion the page must read in full.
- Keep the header comment and `<meta name="generator">`. Keep the "Design: 8B" footer link unless the site owner asks to remove it.

## Replace
- `data-8b-placeholder` (og-image, favicon, email, phone, form): real value in, attribute out; no value, remove the row (no image: drop `og:image`, set `twitter:card` to `summary`).
- Pre-order buttons in the hero and the nav: now #editions; owner's target: your checkout, waitlist or store URL.
- Pre-order Chalk / Pre-order Graphite in editions: now #contact; owner's target: the checkout URL of each finish.
- The form in `#contact` (fields `name`, `email`, `topic`, `message`) sends nothing; `section-script:contact` handles its submit in the page (read it before you connect a service). Formspree: `action="https://formspree.io/f/<id>"` and `fetch` POST `new FormData(form)` first. Netlify: `data-netlify="true"` and a hidden `form-name`. Or delete it and the script.
- The name Hushkey (any letter case); the favicon letter and colours in `<link rel="icon">`.
- Photos (8, Unsplash: modes 4, dimmer 1, material 3): `src`, no `srcset`/`sizes`, `width`/`height` to the ratio, `alt`, CREDITS.md.
- `<title>`, meta description, og tags.

## Ask the owner for
All demo text, never to be invented:
- The price €189 (hero button, editions) and the bundle "any two panels for €340" (editions).
- "Ships in March" (hero note, the FAQ "When does it ship?").
- Payment and returns: pre-orders "charged only when your panel leaves the studio", "thirty days to send it back" (editions, FAQ).
- Product specs: a battery that lasts about two years, USB-C charging, the woven back and a cable in the box (editions, FAQ), and the mounting answer (FAQ "How does it mount?").
- Compatibility: "joins the hub your home already has over the open smart-home standards", works when the internet drops (FAQ, hero note, contact topic "Setting up with my hub").
- Service: "the studio answers within a working day" (contact text and the form's data-sent message).
- Place and hours: "Rotterdam, open Thursdays by appointment" (contact) and "© 2026 Hushkey Studio, Rotterdam" (footer).

## Known limits
- Without JavaScript the phone menu button cannot open the overlay; the links stay reachable in the hero and the footer.
- Mid-wipe frames in modes show two half captions; it resolves within the wipe.
- The modes stage wipes exactly four rooms: the CSS has one wipe rule per item (`#modes .modes__list > li:nth-of-type(2)` to `(4)`), so a fifth room needs its own rule and keyframes.
- Without scroll-driven animations or with reduced motion, modes shows its four rooms as a grid (two by two, one column on phones) and chords shows the two keys already joined and pressed.

## Check
375 and 1440 px, reduced motion on, a browser without scroll-driven animations (Firefox: the finished static layout), console clean; `data-8b-placeholder` and Hushkey left only in class names.
