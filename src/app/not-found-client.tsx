'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { gsap, useGSAP } from '@/lib/gsap';
import { firePetalBurst } from '@/lib/petal-burst';
import Button from '@/components/ui/Button';
import Container from '@/components/ui/Container';

/**
 * 404 — "This bloom has wandered off."
 *
 * A pressed-flower specimen card: a single handcrafted ribbon flower pressed
 * flat and mounted on a warm gift-tag label, with "404" as its specimen
 * catalog number. Motion: the card settles onto the page, the flower head
 * blooms open, the stem draws in, and a gentle puff of petals drifts upward.
 * All motion is gated behind prefers-reduced-motion.
 */

const OUTER_PETAL_D = 'M100 40 C 84 54, 84 74, 100 80 C 116 74, 116 54, 100 40 Z';
const INNER_PETAL_D = 'M100 54 C 91 62, 91 76, 100 80 C 109 76, 109 62, 100 54 Z';

export default function NotFoundClient({
  showFlowers = true,
}: {
  showFlowers?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const flowerGroup = useRef<SVGGElement>(null);
  const flowerSvg = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const card = cardRef.current;
      const bloom = flowerGroup.current;
      const stems = gsap.utils.toArray<SVGPathElement>(
        root.current?.querySelectorAll('[data-stem]') ?? []
      );

      gsap.matchMedia({
        '(prefers-reduced-motion: no-preference)': () => {
          // Card settles onto the page like a specimen being placed down.
          if (card) {
            gsap.from(card, {
              opacity: 0,
              y: 24,
              rotation: -1.2,
              duration: 0.8,
              ease: 'power3.out',
            });
          }
          // Flower head blooms open from its center.
          if (bloom) {
            gsap.from(bloom, {
              scale: 0,
              opacity: 0,
              duration: 0.9,
              ease: 'power2.out',
              transformOrigin: '100px 80px',
              delay: 0.25,
            });
          }
          // Stem + leaves draw in via stroke-dashoffset (stem first, leaves after).
          stems.forEach((path, i) => {
            const length = path.getTotalLength();
            gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
            gsap.to(path, {
              strokeDashoffset: 0,
              duration: 1,
              ease: 'power2.out',
              delay: 0.5 + (i === 0 ? 0 : 0.25),
            });
          });
          // A gentle puff of petals drifts upward from the bloom once it's open.
          const svg = flowerSvg.current;
          if (svg) {
            const r = svg.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height * 0.3;
            gsap.delayedCall(1.0, () => {
              firePetalBurst({ x: cx, y: cy }, { x: cx, y: cy - 115 });
            });
          }
        },
        '(prefers-reduced-motion: reduce)': () => {
          // Everything visible immediately, no motion, no petal burst.
          if (bloom) {
            gsap.set(bloom, { scale: 1, opacity: 1, transformOrigin: '100px 80px' });
          }
          stems.forEach((path) => {
            gsap.set(path, { strokeDasharray: 'none', strokeDashoffset: 0 });
          });
        },
      });
    },
    { scope: root, dependencies: [] }
  );

  const outerPetals = Array.from({ length: 6 }, (_, i) => (
    <path
      key={`outer-${i}`}
      d={OUTER_PETAL_D}
      fill="#F9E4E4"
      stroke="#D4A5A5"
      strokeWidth={1.5}
      transform={`rotate(${(i * 360) / 6} 100 80)`}
    />
  ));

  const innerPetals = Array.from({ length: 6 }, (_, i) => (
    <path
      key={`inner-${i}`}
      d={INNER_PETAL_D}
      fill="#F3E4D3"
      stroke="#D4A5A5"
      strokeWidth={1}
      opacity={0.85}
      transform={`rotate(${(i * 360) / 6 + 30} 100 80)`}
    />
  ));

  return (
    <section
      ref={root}
      className="relative isolate flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden bg-background py-8 sm:py-10"
    >
      {/* Frosted wrapping grid + warm light */}
      <div aria-hidden="true" className="wrapping-grid absolute inset-0 opacity-60" />
      <div aria-hidden="true" className="vignette absolute inset-0" />

      {/* Ambient falling petals — behind content (z-0), reduced-motion-guarded */}
      <span className="petal text-rose-line text-xs"   style={{ left: '10%', animationDuration: '11s', animationDelay: '0s' }}  aria-hidden="true">&#10040;</span>
      <span className="petal text-rose-line text-sm"   style={{ left: '22%', animationDuration: '14s', animationDelay: '3s' }}  aria-hidden="true">&#10047;</span>
      <span className="petal text-rose-line text-base" style={{ left: '78%', animationDuration: '12s', animationDelay: '1.5s' }} aria-hidden="true">&#10040;</span>
      <span className="petal text-rose-line text-xs"   style={{ left: '88%', animationDuration: '15s', animationDelay: '5s' }}  aria-hidden="true">&#10047;</span>
      <span className="petal text-rose-line text-sm"   style={{ left: '50%', animationDuration: '13s', animationDelay: '7s' }}  aria-hidden="true">&#10040;</span>

      <Container className="relative z-10">
        <div
          ref={cardRef}
          className="gift-card is-emphasized mx-auto max-w-xl px-8 py-8 sm:px-12 sm:py-10"
        >
          {/* Pressed ribbon flower specimen */}
          <div className="flex justify-center">
            <svg
              ref={flowerSvg}
              width="130"
              height="182"
              viewBox="0 0 200 280"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Hand-drawn specimen strokes — boil like ink settling.
                  GSAP's stem draw-in animates stroke-dashoffset (not
                  transform), so the two compose without conflict. */}
              <g className="line-boil">
                {/* Stem + leaves — draw in on mount (warm tan, not green) */}
                <path
                  data-stem
                  d="M100 115 Q 97 180 100 270"
                  stroke="#B99A72"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  data-stem
                  d="M100 175 Q 78 168 70 150 Q 86 158 100 175"
                  stroke="#B99A72"
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill="#B99A72"
                  fillOpacity={0.25}
                />
                <path
                  data-stem
                  d="M100 210 Q 122 203 130 185 Q 114 193 100 210"
                  stroke="#B99A72"
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill="#B99A72"
                  fillOpacity={0.25}
                />

                {/* Ribbon tails — the "ribbon" in ribbon flower */}
                <path d="M95 115 Q 86 140 82 168" stroke="#D4A5A5" strokeWidth={2.5} strokeLinecap="round" fill="none" />
                <path d="M105 115 Q 114 140 118 168" stroke="#D4A5A5" strokeWidth={2.5} strokeLinecap="round" fill="none" />
              </g>
              <rect x={95} y={111} width={10} height={9} rx={1.5} fill="#D4A5A5" />

              {/* Flower head — blooms open from center */}
              <g ref={flowerGroup}>
                {outerPetals}
                {innerPetals}
                <circle cx={100} cy={80} r={7} fill="#D4A5A5" />
                <circle cx={100} cy={80} r={3} fill="#F9E4E4" />
              </g>
            </svg>
          </div>

          {/* Specimen label divider */}
          <div className="gift-divider my-5" />

          {/* Specimen catalog number */}
          <p className="text-center font-sans text-[11px] uppercase tracking-[0.3em] text-muted">
            Specimen &#8470;404
          </p>

          {/* Heading */}
          <h1 className="mt-3 text-center font-sans text-2xl font-bold uppercase tracking-[0.06em] text-foreground sm:text-3xl">
            This bloom has wandered off
          </h1>

          {/* Handwritten nudge */}
          <p className="mt-2 text-center font-hand text-3xl leading-none text-rose-deep">
            let&rsquo;s find our way back ♡
          </p>

          {/* Subtext */}
          <p className="mt-3 text-center font-sans text-base text-muted">
            The page you&rsquo;re looking for isn&rsquo;t in our garden.
          </p>

          {/* CTAs */}
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button as={Link} href="/" variant="primary" size="lg">
              Return home
            </Button>
            {showFlowers && (
              <Button as={Link} href="/flowers" variant="secondary" size="md">
                Browse the garden
              </Button>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}