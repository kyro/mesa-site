# Sheaf smoke-test landing page (DRAFT)

A single-page demand test for a compact e-ink notebook. It's plain static HTML, CSS and JS like the rest of this repo, with no build step and no dependencies. It is self-contained: nothing outside this folder links to it, and it doesn't use any shared site assets.

## Run it

```sh
# from the repo root
python3 -m http.server 8000
# open http://localhost:8000/smoke-test/
```

## Variants

One layout. The URL params choose the variant:

| Param   | Values          | Default | Effect                          |
|---------|-----------------|---------|---------------------------------|
| `angle` | `a`, `b`, `c`   | `a`     | Eyebrow, headline, subhead, highlights, "how it works" |
| `price` | `399`, `449`    | `399`   | Price reveal amount             |
| `draft` | `0`             | (shown) | Hides the DRAFT tag             |
| `view`  | `thanks`, `disclosure` | (page) | Opens that state directly, for QA |
| `debug` | `1`             | off     | Logs analytics stub events to the console |

- Angle a is "scattered ambitious / becoming" (the lead persona).
- Angle b is "the paper planner that plans itself".
- Angle c is "AI power user review desk".

Example: `/smoke-test/?angle=c&price=449`. Unknown values fall back to the defaults.

## Swap copy

All copy lives in `copy.js` (`window.LP_COPY`). Edit only the values there:

- `productName`, `meta.*` and `images.*` (alt text) hold the name, page meta and image descriptions. The static `<title>` and OG tags in `index.html` are crawler fallbacks, so update them too when final meta lands.
- `angles.a|b|c` holds the per-angle copy.
- `price.note` uses `{ai}`. Set `ai.name` to the final name, or set `ai.useFallback: true` to read "the smart features" instead. No renewal price is shown.
- `reserve.deposit` is the deposit amount (`$49`), and `disclosure.*` holds the fake-door text (final text pending).
- To add or rename a price variant, edit `variants.prices` and `variants.defaultPrice`.
- `flags.showDraftTag: false` removes the DRAFT tag for everyone.

Rule: no headline may contain "AI". If one does, `app.js` warns in the console and in the DRAFT tag.

## Re-skin

The current neutral look is a placeholder until the Sheaf v3 visuals arrive. Every color, font, radius and shadow is a CSS variable in `theme.css`, and `style.css` holds only layout and component rules. To re-skin, edit `theme.css`. Self-hosted fonts or new image assets can go in this folder.

## Flow

The flow is signup first. The email form is in the hero and again under the price reveal. Submitting it shows a thank-you screen that offers **Reserve for $49 (refundable)**. That button is a fake door: clicking it shows the disclosure. The page has no payment fields.

## Stubs (not wired)

All stubs are at the top of `app.js`:

- `submitSignup(email)` keeps nothing and resolves immediately.
- `startReserve()` takes no payment and resolves immediately.
- `analytics.track(event, props)` is a no-op. The events are `page_view`, `nav_cta`, `signup_submit`, `thanks_view`, `reserve_click` and `disclosure_view`.

## Images

`img/notebook-open.*` and `img/notebook-closed.*` are the designer's render crops. The thin white borders are trimmed, and the lettering on the stylus and the mark under the screen are retouched out. No other edits were made, so the device keeps its true shape. Each image ships as WebP with a PNG fallback.

## Deploy

This repo's GitHub Pages builds from `main` (legacy, `.nojekyll`), so merging this folder publishes it. See `.github/workflows/pages.yml` for the opt-in deploy that excludes `smoke-test/`. The page also sets `noindex, nofollow`.
