// under-construction.tsx

/**
 * UnderConstruction — the full-page "coming soon" screen.
 *
 * Rendered by the root layout while the storefront is in construction mode,
 * with no Navbar, Footer, cart, or providers around it — so this component
 * owns the entire viewport. It reads as a gallery wall: hairline rails at the
 * top and bottom edges, a closed ribbon-flower bud swaying gently (still
 * blooming, not yet open), and a museum-label text stack — Playfair serif
 * heading, Inter supporting copy, rose hairline accents, and a plain mailto
 * contact path. No form, no signup, no backend.
 *
 * Static markup + CSS only (no GSAP, no client boundary): the entrance is a
 * staggered `fade-up` declared under `(prefers-reduced-motion: no-preference)`
 * in globals.css (see `.uc-enter`), and the bud's sway rides the existing
 * `.animate-sway` utility, collapsed by the global reduced-motion guard. This
 * renders identically in the static bake and on the client.
 */
export default function UnderConstruction() {
  return (
    <section
      aria-labelledby="under-construction-title"
      className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-background"
    >
      {/* Ambient glow — soft blush center, faint lavender wash lower-right */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 45% at 50% 42%, rgba(249, 228, 228, 0.55), rgba(249, 228, 228, 0) 70%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 40% 30% at 82% 88%, rgba(232, 213, 232, 0.35), rgba(232, 213, 232, 0) 70%)',
        }}
      />

      {/* Gallery rails — hairline frame at the very top and bottom edges */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-border" />

      {/* Wall label */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="mx-auto w-full max-w-xl text-center">
          {/* Ribbon-flower bud, swaying at the stem base */}
          <div className="uc-enter flex justify-center">
            <svg
              width="140"
              height="175"
              viewBox="0 0 160 200"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="animate-sway origin-bottom"
              style={{ animationDuration: '5s' }}
            >
              {/* Stem */}
              <path
                d="M80 76 C 77 118 82 158 80 196"
                stroke="#B5A77A"
                strokeWidth={2}
                strokeLinecap="round"
                fill="none"
              />
              {/* Leaves */}
              <path
                d="M78 118 C 63 112 55 98 59 84 C 69 94 76 106 78 118 Z"
                fill="#B5A77A"
                fillOpacity={0.15}
                stroke="#B5A77A"
                strokeOpacity={0.55}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
              <path
                d="M82 148 C 96 142 104 128 101 114 C 93 122 85 134 82 148 Z"
                fill="#B5A77A"
                fillOpacity={0.15}
                stroke="#B5A77A"
                strokeOpacity={0.55}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
              {/* Sepals at the bud base */}
              <path d="M75 68 C 67 73 65 82 68 90 C 73 83 75 77 75 68 Z" fill="#B5A77A" fillOpacity={0.35} />
              <path d="M85 68 C 93 73 95 82 92 90 C 87 83 85 77 85 68 Z" fill="#B5A77A" fillOpacity={0.35} />
              {/* Closed bud — about to open */}
              <path
                d="M80 16 C 60 32 62 62 80 74 C 98 62 100 32 80 16 Z"
                fill="#F9E4E4"
                stroke="#D4A5A5"
                strokeWidth={1.5}
              />
              <path d="M80 28 C 68 38 70 58 80 68 C 90 58 92 38 80 28 Z" fill="#E8D5E8" fillOpacity={0.85} />
              <path d="M80 33 L 80 62" stroke="#D4A5A5" strokeWidth={1} strokeOpacity={0.65} strokeLinecap="round" />
              {/* Ribbon knot + tails */}
              <rect x={74.5} y={68} width={11} height={10} rx={1.5} fill="#D4A5A5" />
              <path d="M76 78 C 70 90 64 102 60 114" stroke="#D4A5A5" strokeWidth={2} strokeLinecap="round" fill="none" />
              <path d="M84 78 C 90 90 96 102 100 114" stroke="#D4A5A5" strokeWidth={2} strokeLinecap="round" fill="none" />
            </svg>
          </div>

          <p
            className="uc-enter mt-10 font-sans text-[11px] uppercase tracking-[0.3em] text-muted"
            style={{ animationDelay: '0.08s' }}
          >
            Under construction
          </p>

          <h1
            id="under-construction-title"
            className="uc-enter mt-4 font-serif text-4xl font-bold leading-[1.15] text-foreground sm:text-5xl"
            style={{ animationDelay: '0.16s' }}
          >
            Something lovely is <em className="italic">blooming</em>
          </h1>

          <p
            className="uc-enter mx-auto mt-5 max-w-md font-sans text-base leading-relaxed text-muted"
            style={{ animationDelay: '0.24s' }}
          >
            We&rsquo;re putting the finishing touches on our garden of
            handcrafted ribbon flowers. Every petal is made by hand. The
            shop will open very soon.
          </p>

          {/* Divider + contact path */}
          <div
            className="uc-enter mt-10 flex flex-col items-center gap-4"
            style={{ animationDelay: '0.32s' }}
          >
            <div aria-hidden="true" className="flex items-center gap-3">
              <span className="h-px w-12 bg-rose/50" />
              <span className="text-xs leading-none text-rose">&#10040;</span>
              <span className="h-px w-12 bg-rose/50" />
            </div>
            <p className="font-sans text-sm text-muted">
              Until then, contact us at{' '}
              <a
                href="mailto:contact@emilysflowers.ca"
                className="border-b border-rose/60 font-medium text-foreground transition-colors duration-300 hover:border-rose hover:text-rose"
              >
                contact@emilysflowers.ca
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Brand caption, resting just above the bottom rail */}
      <div className="relative z-10 pb-8 pt-6 text-center">
        <p className="font-sans text-xs tracking-wide text-muted">
          Emily&rsquo;s Flowers: handcrafted ribbon flowers &amp; bouquets
        </p>
      </div>
    </section>
  );
}
