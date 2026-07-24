'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger);
  // ScrollTrigger writes to body.style on enable(); clearing it avoids a Next.js hydration warning.
  document.body.removeAttribute('style');
}

export { gsap, ScrollTrigger, useGSAP };