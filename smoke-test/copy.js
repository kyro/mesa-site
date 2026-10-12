/*
 * ALL page copy and variant config lives in this file. Everything here is DRAFT.
 * Swap final copy by editing values only; keys are read by app.js.
 *
 * Tokens filled in at render time:
 *   {project}  -> productName
 *   {ai}       -> ai.name, or ai.fallback when ai.useFallback is true
 *   {price}    -> the active price variant, e.g. "$399"
 *   {deposit}  -> reserve.deposit
 *
 * Rule: no headline (angle headline or any section title) may contain "AI".
 * app.js warns in the console and in the DRAFT tag if one does.
 */
window.LP_COPY = {
  productName: "Sheaf",

  flags: {
    // Set to false (or load the page with ?draft=0) to hide the DRAFT tag.
    showDraftTag: true
  },

  variants: {
    defaultAngle: "a",
    prices: ["399", "449"],
    defaultPrice: "399",
    currency: "$"
  },

  ai: {
    name: "[AI]",
    fallback: "the smart features",
    useFallback: false
  },

  meta: {
    title: "{project}: a calm, paper-like notebook",
    description: "A compact e-ink notebook that turns what you write into today's next steps. Quiet by design.",
    ogImageAlt: "A compact e-ink notebook, open in an orange folio cover, with a stylus resting on the screen"
  },

  images: {
    open: "A compact e-ink notebook, open in an orange folio cover, with a stylus resting on its handwritten page",
    closed: "The same notebook closed in its orange folio cover, stylus tucked into the spine"
  },

  angles: {
    // (a) scattered ambitious / becoming. Lead persona, default angle.
    a: {
      eyebrow: "For people with more plans than days",
      headline: "Become the person your plans already describe.",
      subhead: "A pocket-sized, paper-like notebook that hands you the next move on each of your projects every morning. Away from screens, even out in the sun.",
      proofs: ["Today's page is ready when you wake up", "Speak a thought, see it in ink", "No streaks, no guilt, no feed"],
      storyTitle: "Less sorting. More doing.",
      story: [
        { title: "Write it all down", body: "Plans, ideas and half-thoughts, in ink, the way you already do." },
        { title: "Wake up to a page", body: "Overnight, what you wrote becomes a short list of next steps for each project." },
        { title: "Do the next thing", body: "One page. Nothing to scroll. Close the cover and get on with it." }
      ]
    },
    // (b) paper planner that plans itself
    b: {
      eyebrow: "A planner, finally",
      headline: "The paper planner that plans itself.",
      subhead: "Each morning it draws today's page from your calendar and projects, and carries forward what you didn't finish. You just write.",
      proofs: ["Calendar blocks drawn for you", "Unfinished items carried forward", "Feels like paper, lasts for weeks"],
      storyTitle: "A fresh page, already filled in.",
      story: [
        { title: "Connect your calendar", body: "Meetings and blocks land on the page before you open the cover." },
        { title: "Write as usual", body: "Tick things off, scribble notes, add tasks in the margins." },
        { title: "Tomorrow takes care of itself", body: "Whatever you didn't finish moves to the next page, on its own." }
      ]
    },
    // (c) AI power user review desk. Headline must not say "AI".
    c: {
      eyebrow: "For people who work with agents",
      headline: "A quiet review desk for everything your agents do.",
      subhead: "Bring your own AI or agents. Read, approve and redirect their work on calm ink instead of another glowing tab.",
      proofs: ["Bring your own model or agents", "Review and approve in ink", "Nothing pings you"],
      storyTitle: "Step back from the screen. Stay in charge.",
      story: [
        { title: "Connect your tools", body: "Point your own models and agents at the notebook. No new account to babysit." },
        { title: "Review on paper", body: "Drafts, summaries and decisions arrive as pages you can read properly." },
        { title: "Redirect in ink", body: "Circle, strike, annotate. Your marks go back as instructions." }
      ]
    }
  },

  signup: {
    label: "Email address",
    placeholder: "you@example.com",
    button: "Get early access",
    note: "No payment. We'll only email you about {project}.",
    error: "Please enter a valid email address."
  },

  price: {
    title: "One notebook. One price.",
    label: "Price",
    // Final wording: "First year of [AI] included, works forever without it".
    // Set ai.useFallback to true to read "the smart features" instead.
    note: "First year of {ai} included, works forever without it.",
    details: ["Notebook, folio cover and stylus", "Ships to early-access members first"]
  },

  thanks: {
    title: "You're on the list.",
    body: "We'll email you when {project} is ready. Nothing else.",
    offerLead: "Want a place in the first batch?",
    back: "Back to the page"
  },

  reserve: {
    deposit: "$49",
    button: "Reserve for {deposit} (refundable)"
  },

  // Fake-door disclosure. Shown only after someone clicks Reserve.
  disclosure: {
    title: "Reservations aren't open yet",
    body: "[DISCLOSURE SLOT] Final disclosure text pending. Placeholder: {project} is still in development, so we haven't taken a deposit and you haven't been charged. You're on the early-access list and will hear from us first when reservations open."
  },

  nav: { cta: "Get early access" },
  footer: "© {project}"
};
