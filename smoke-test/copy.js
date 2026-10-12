/*
 * ALL page copy and variant config lives in this file. Edit values only;
 * keys are read by app.js. Source: designer handoff v0.4 (DRAFT, not yet approved).
 *
 * Tokens filled in at render time:
 *   {project}  -> productName
 *   {price}    -> the visitor's price variant, e.g. "$399"
 *   {deposit}  -> reserve.deposit
 *
 * Rules: no headline may contain "AI" (app.js warns if one does).
 * Say "list" or "early access", never "waitlist". No ship dates, scarcity,
 * "membership", renewal prices, or claims that a place is held.
 */
window.LP_COPY = {
  productName: "Sheaf",

  flags: {
    // Set to false (or load the page with ?draft=0) to hide the DRAFT tag.
    showDraftTag: true,
    // H1 A/B: when enabled (or with ?h1=override), every angle's H1 becomes
    // this text. The angle's eyebrow, subhead and proofs stay. Events carry h1.
    headlineOverride: { enabled: false, text: "Think outside the lines." }
  },

  variants: {
    defaultAngle: "a",
    // ?price= wins. Otherwise each visitor gets one price at random, kept
    // sticky in localStorage + a cookie. Independent of the angle.
    prices: ["399", "449"],
    currency: "$"
  },

  meta: {
    title: "{project}: a pocket notebook that draws your day",
    description: "A small e-ink notebook with a pen and a cover. You write on it like paper. Each morning it draws the day's page for you.",
    ogImageAlt: "A small e-ink notebook, open in a lime cover, with a pen resting on its handwritten page"
  },

  images: {
    // Renders must carry this label until real prototype photos replace them.
    // Shown as the pink sticky note on the hero render.
    caption: "design in progress",
    open: "A small e-ink notebook, open in a lime cover, with a pen resting on its handwritten page",
    closed: "The same notebook closed in its lime cover, pen tucked into the spine"
  },

  angles: {
    // a · Becoming. Lead persona (scattered ambitious), default angle.
    a: {
      eyebrow: "For people building something",
      headline: "Your move.",
      subhead: "A pocket notebook that draws your day each morning: what's on the calendar, the next step on every project, and what carried over from yesterday. Take it to the park.",
      proofs: ["The page draws itself every morning", "Say it, see it in ink", "No apps, no feed, no notifications"],
      heroDirection: "Her on a bench, notebook open on her knee, phone nowhere."
    },
    // b · Plans itself. No "ADHD" in headline or ad by default.
    b: {
      eyebrow: "A planner, finally",
      headline: "The paper planner that plans itself.",
      subhead: "For brains that jump. A fresh page every morning with yesterday's loose ends already carried over. Nothing to set up, nothing to keep up.",
      proofs: ["No system to maintain", "No streaks to break", "A short, fixed page, not a blank one"],
      heroDirection: "A shelf of half-used planners, the notebook on top open to a filled page. Light, not shaming."
    },
    // c · Review desk (AI power user). No "AI" in eyebrow or headline.
    // Claim check pending: if footage doesn't show a pen mark going back to the
    // agent, proof 2 becomes "Mark it up with a pen" and the subhead drops
    // "and it goes back to them".
    c: {
      eyebrow: "For people who run agents",
      headline: "Your agents, on paper.",
      subhead: "Each morning, one ink page: what got done, what needs your call, what's next. Mark it with a pen and it goes back to them.",
      proofs: ["Bring your own AI or agents", "Decide with a pen", "Only what you ask for. Nothing pings you"],
      heroDirection: "A daily page with three short agent results and handwritten ticks and strikes, coffee, no laptop."
    }
  },

  nav: { link: "The notebook" },

  // The one band (Anton caps).
  band: "Less scrolling. More scribbling.",

  // Hand-lettered starburst on the hero render. When the H1 already says it
  // (angle a), the sticker shows `ifHeadlineMatches` instead.
  sticker: { text: "your move.", ifHeadlineMatches: "just ink." },

  // Sign-off above the repeat signup and on the thank-you screen.
  signoff: "Your move.",

  // Shared, below the fold.
  about: {
    title: "What it is",
    body: "A small e-ink notebook with a pen and a cover, made to carry everywhere. You write on it like paper. Each morning it draws the day's page for you.",
    // Add size and battery only once hardware confirms.
    hardware: "Pocket-size. Readable in direct sun."
  },

  signup: {
    label: "Email address",
    placeholder: "you@email.com",
    button: "Get early access",
    note: "Free to join. No card. Leave the list any time.",
    error: "Please enter a valid email address."
  },

  // Thank-you screen (only after signup): price line, Reserve, skip.
  thanks: {
    title: "You're on the list.",
    skip: "No thanks, just keep me posted",
    skipped: "Got it. We'll keep you posted."
  },

  price: {
    label: "Price",
    note: "Notebook, cover and pen. First year of [AI] included, works forever without it.",
    // Used while the AI layer is unnamed: set useFallback to true.
    noteFallback: "Notebook, cover and pen. First year of the smart features included, works forever without them.",
    useFallback: false
  },

  reserve: {
    deposit: "$49",
    button: "Reserve with a {deposit} refundable deposit",
    note: "Fully refundable."
  },

  // Fake-door disclosure, shown after Reserve is clicked. Never say a place is
  // "held" or "secured", and never mention a batch or ship date.
  disclosure: {
    title: "Reservations aren't open yet.",
    body: [
      "Thanks for clicking Reserve. We're a small team deciding whether to make {project}, and this tells us a lot. Nobody was charged and we never asked for card details.",
      "You're already on the list, so you'll hear first if reservations open. You can leave the list any time from any email."
    ]
  },

  footer: {
    text: "{project} is in development. Features shown are from a working prototype and may change.",
    // Placeholders until the domain is decided. Hrefs in [brackets] render as "#".
    links: [
      { label: "Privacy", href: "[PRIVACY URL]" },
      { label: "Contact", href: "[CONTACT URL]" }
    ]
  }
};
