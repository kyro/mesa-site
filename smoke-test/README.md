# Sheaf smoke-test landing page (DRAFT)

A single-page demand test for a compact e-ink notebook. It's plain static HTML, CSS and JS like the rest of this repo, with no build step and no dependencies. It is self-contained: nothing outside this folder links to it, and it doesn't use any shared site assets. Copy follows designer handoff v0.4, which isn't approved yet.

## Run it

```sh
# from the repo root
python3 -m http.server 8000
# open http://localhost:8000/smoke-test/
```

## Variants

One layout. The URL params choose the variant:

| Param   | Values                 | Default         | Effect |
|---------|------------------------|-----------------|--------|
| `angle` | `a`, `b`, `c`          | `a`             | Eyebrow, headline, subhead, proofs |
| `price` | `399`, `449`           | random, sticky  | Price line on the thank-you screen |
| `draft` | `0`                    | (shown)         | Hides the DRAFT tag |
| `view`  | `thanks`, `disclosure` | (landing)       | Opens that state directly, for QA |
| `debug` | `1`                    | off             | Logs analytics stub events to the console |

- Angle a is "Becoming" (lead persona, scattered ambitious).
- Angle b is "Plans itself".
- Angle c is "Review desk" (AI power user).

Without `?price=`, each visitor gets $399 or $449 at random (50/50). The choice sticks via localStorage and an `lp_price` cookie. Example: `/smoke-test/?angle=c&price=449`. Unknown values fall back to the defaults.

## Flow

1. **Landing page:** eyebrow, headline, subhead, hero image, and the email field with "Get early access". There is no price on this page.
2. **Below the fold:** a "what it is" paragraph, the three proofs, the hardware line, a repeat signup, and the footer.
3. **Thank-you screen (after signup):** "You're on the list.", the price line, **Reserve with a $49 refundable deposit**, and "No thanks, just keep me posted".
4. **Reserve click:** this is a fake door. It shows the disclosure, and the page has no payment fields.

## Swap copy

All copy lives in `copy.js` (`window.LP_COPY`). Edit only the values there. The keys match the designer handoff:

- `angles.a|b|c` holds `eyebrow`, `headline`, `subhead`, `proofs` and `heroDirection`. `heroDirection` is the art direction note; it is not rendered.
- `about.*` holds the shared "what it is" paragraph and the hardware line.
- `price.note` is the price line. Set `price.useFallback: true` to use the "smart features" wording until the AI layer is named. No renewal price is shown.
- `reserve.*` holds the deposit amount and the button label, and `disclosure.*` holds the fake-door text.
- `images.caption` is the "Design in progress" label on renders. Keep it until real prototype photos replace them.
- `footer.*` holds the in-development line and the privacy and contact links. Links in `[BRACKETS]` render as `#` until the domain is decided.
- `meta.*` holds the page title, description and OG text. The static tags in `index.html` are crawler fallbacks, so update them too.
- `flags.showDraftTag: false` removes the DRAFT tag for everyone.

Copy rules: no headline or eyebrow may contain "AI" (`app.js` warns in the console and in the DRAFT tag). Say "list" or "early access", never "waitlist". No "membership", renewal price, ship date or batch, and never say a place is held.

## Re-skin

The current neutral look is a placeholder until the Sheaf v3 visuals arrive. Every color, font, radius and shadow is a CSS variable in `theme.css`, and `style.css` holds only layout and component rules. To re-skin, edit `theme.css`. New fonts or image assets can go in this folder.

## Stubs (not wired)

All stubs are at the top of `app.js`:

- `submitSignup(email)` keeps nothing and resolves immediately.
- `startReserve()` takes no payment and resolves immediately.
- `analytics.track(event, props)` is a no-op. The events are `lp_view`, `email_submit`, `thanks_view`, `reserve_click` and `skip_click`. Each one carries `angle`, `price`, `utm_source`, `utm_campaign` and `utm_content`.

## Images

`img/notebook-open.*` and `img/notebook-closed.*` are the designer's render crops. The thin white borders are trimmed, and the lettering on the pen and the mark under the screen are retouched out. No other edits were made, so the device keeps its true shape. Each image ships as WebP with a PNG fallback.

## Deploy

This repo's GitHub Pages builds from `main` (legacy, `.nojekyll`), so merging this folder publishes it. See `.github/workflows/pages.yml` for the opt-in deploy that excludes `smoke-test/`. The page also sets `noindex, nofollow`.
