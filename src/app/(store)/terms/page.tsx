import type { Metadata } from 'next';
import Container from '@/components/ui/Container';
import StarMotif from '@/components/ui/StarMotif';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern your use of emilysflowers.ca and any purchase you make from Emily\u2019s Flowers.',
  alternates: {
    canonical: '/terms',
  },
};

const cardClass = 'stitch relative bg-background px-6 py-8 sm:px-10 sm:py-10';
const h2Class =
  'font-sans text-xl font-bold uppercase tracking-[0.1em] text-foreground sm:text-2xl';
const h3Class =
  'mt-8 font-sans text-sm font-bold uppercase tracking-[0.08em] text-foreground';
const pClass = 'mt-5 font-sans text-base leading-relaxed text-muted';
const ulClass =
  'mt-5 list-disc space-y-3 pl-5 font-sans text-base leading-relaxed text-muted';

function Section({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cardClass}>
      {title ? (
        <>
          <h2 className={h2Class}>{title}</h2>
          <div className="gift-divider mt-4" />
        </>
      ) : null}
      {children}
    </div>
  );
}

export default function TermsOfServicePage() {
  return (
    <div className="relative isolate overflow-hidden py-16 sm:py-24">
      {/* Warm wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 50% 40% at 50% 15%, rgba(249, 228, 228, 0.45), rgba(254, 250, 245, 0) 70%)',
        }}
      />

      <Container className="relative z-10">
        <div className="mx-auto max-w-3xl">
          <div className="relative">
            <StarMotif size={48} className="absolute -left-8 -top-6 text-rose opacity-70" />
            <h1 className="font-sans text-3xl font-bold uppercase tracking-[0.06em] text-foreground sm:text-4xl">
              Terms of Service
            </h1>
            <p className="mt-2 font-sans text-sm text-muted">Last updated: August 24, 2026</p>
          </div>

          <div className="mt-10 space-y-8">
            <Section>
              <p className={pClass}>
                These Terms of Service (the &ldquo;Terms&rdquo;) are a legal agreement between you
                and Emily&rsquo;s Flowers (the &ldquo;Site&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;,
                or &ldquo;our&rdquo;) governing your access to and use of emilysflowers.ca (the
                &ldquo;Site&rdquo;) and any related services we provide, including the purchase of
                products through the Site (collectively, the &ldquo;Services&rdquo;). For purposes
                of these Terms, &ldquo;you&rdquo; and &ldquo;your&rdquo; means you as the user of
                the Services, whether you are a customer, website visitor, or another individual who
                interacts with the Site.
              </p>
              <p className={pClass}>
                Please read these Terms carefully. By accessing or using the Services, or by placing
                an order through the Site, you agree to be bound by these Terms. If you do not agree
                to these Terms, please do not use or access any of the Services. Your use of the
                Services is also subject to our{' '}
                <a
                  href="/privacy"
                  className="underline decoration-rose-line underline-offset-4 hover:text-foreground"
                >
                  Privacy Policy
                </a>
                , which describes how we collect, use, and disclose your personal information.
              </p>

              <h3 className={h3Class}>Changes to These Terms</h3>
              <p className={pClass}>
                We may update these Terms from time to time, including to reflect changes to our
                practices or for other operational, legal, or regulatory reasons. We will post the
                revised Terms on the Site and update the &ldquo;Last updated&rdquo; date. Any
                changes apply only prospectively, and your continued use of the Services after the
                revised Terms are posted constitutes your acceptance of the changes.
              </p>
            </Section>

            <Section title="The Services">
              <p className={pClass}>
                Emily&rsquo;s Flowers offers handcrafted ribbon flowers and bouquets made by hand,
                one petal at a time. Because every item is handmade, each piece is unique: slight
                variations in color, size, shape, and finish are natural characteristics of
                handcrafted work and are not defects. Product photographs and descriptions on the
                Site are intended to represent our items accurately, but colors may appear slightly
                different depending on your screen and lighting.
              </p>
            </Section>

            <Section title="Using the Site">
              <p className={pClass}>
                You may use the Services only for lawful, personal, non-commercial purposes. By
                using the Services, you agree not to:
              </p>
              <ul className={ulClass}>
                <li>
                  interfere with or disrupt the operation of the Site, including attempting to
                  circumvent any security or rate-limiting measures;
                </li>
                <li>
                  place fraudulent orders or provide false, inaccurate, or misleading information;
                </li>
                <li>
                  scrape, copy, or harvest content or information from the Site without our prior
                  written permission; or
                </li>
                <li>
                  use the Services in violation of any applicable law or regulation.
                </li>
              </ul>
              <p className={pClass}>
                We reserve the right to refuse service, cancel orders, or limit access to the
                Services to any person or region at any time, including where we reasonably suspect
                fraud or misuse.
              </p>
            </Section>

            <Section title="Products, Pricing, and Payment">
              <p className={pClass}>
                All prices on the Site are listed in Canadian dollars and are subject to change at
                any time without notice. The price applicable to your order is the price displayed
                at the time your order is placed and confirmed.
              </p>
              <p className={pClass}>
                Payments are processed by our payment processor, Stripe. When you complete checkout,
                Stripe collects and processes your payment information in accordance with
                Stripe&rsquo;s terms and privacy policy. We never receive or store your full payment
                card details.
              </p>
              <p className={pClass}>
                Your receipt of an order confirmation email acknowledges that we have received your
                order; it does not confirm our acceptance of it. We reserve the right to decline or
                cancel all or part of any order after it has been placed, for example if an item is
                unavailable, if an error in pricing or product information occurs, or if the order
                appears fraudulent. If we cancel a paid order, we will issue a refund for the
                cancelled amount.
              </p>
            </Section>

            <Section title="Shipping">
              <p className={pClass}>
                Orders are shipped using ChitChats, our shipping provider. Shipping options and
                costs are shown at checkout before you complete your purchase. Any delivery dates or
                timeframes we provide are good-faith estimates only and are not guarantees. We are
                not responsible for delays caused by carriers, customs, weather, or other events
                outside our reasonable control.
              </p>
              <p className={pClass}>
                Please double-check your shipping address before placing your order. We ship to the
                address provided at checkout and are not responsible for orders shipped to an
                incorrectly entered address.
              </p>
            </Section>

            <Section title="Returns and Refunds">
              <p className={pClass}>
                <strong>All Sales Are Final:</strong> Once an order is confirmed and payment is
                processed, no cancellations, returns, or refunds will be accepted.
              </p>
              <p className={pClass}>
                Because every item is handcrafted to order, please review your cart, shipping
                details, and order summary carefully before completing checkout. This policy does
                not affect any non-waivable rights you may have under applicable consumer protection
                laws.
              </p>
            </Section>

            <Section title="Intellectual Property">
              <p className={pClass}>
                The Site and its contents &mdash; including product designs, photographs, text,
                graphics, logos, and the overall look and feel of the Site &mdash; are owned by
                Emily&rsquo;s Flowers and are protected by copyright, trademark, and other
                intellectual property laws. You may not reproduce, distribute, modify, or create
                derivative works from any part of the Site without our prior written permission.
                Handcrafted items purchased through the Site remain subject to the same protections;
                buying an item does not transfer any right to reproduce its design.
              </p>
            </Section>

            <Section title="Third-Party Links and Services">
              <p className={pClass}>
                The Services rely on third-party providers who process information and transactions
                on our behalf, including Stripe (payment processing), ChitChats (shipping), Resend
                (delivery of order emails), and Cloudflare (hosting and security). The Site may also
                contain links to third-party websites or platforms, such as our social media pages.
                We do not control and are not responsible for third-party sites or services, and
                your dealings with them are governed by their own terms and policies.
              </p>
            </Section>

            <Section title="Disclaimers and Limitation of Liability">
              <p className={pClass}>
                The Services are provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
                basis. To the fullest extent permitted by law, we disclaim all warranties,
                express or implied, including implied warranties of merchantability and fitness for
                a particular purpose. We do not warrant that the Services will be uninterrupted,
                secure, or error-free.
              </p>
              <p className={pClass}>
                To the fullest extent permitted by law, Emily&rsquo;s Flowers will not be liable for
                any indirect, incidental, special, consequential, or punitive damages arising out of
                or relating to your use of the Services. Our total liability arising out of or
                relating to any order will not exceed the amount you actually paid for that order.
              </p>
            </Section>

            <Section title="Governing Law">
              <p className={pClass}>
                These Terms are governed by and construed in accordance with the laws of Canada and
                the province in which Emily&rsquo;s Flowers operates, without regard to
                conflict-of-laws principles. You agree that any dispute arising out of or relating
                to these Terms or the Services will be resolved in the courts located there, and you
                submit to the jurisdiction of those courts.
              </p>
            </Section>

            <Section title="Contact">
              <p className={pClass}>
                If you have any questions about these Terms, please email us at{' '}
                <a
                  href="mailto:contact@emilysflowers.ca"
                  className="underline decoration-rose-line underline-offset-4 hover:text-foreground"
                >
                  contact@emilysflowers.ca
                </a>
                .
              </p>
            </Section>

            <Section>
              <div className="flex justify-center" aria-hidden="true">
                <span className="text-lg text-rose-line">&#10047;</span>
              </div>
              <p className={`${pClass} text-center`}>
                Thank you for supporting handmade work. Every order helps a small shop grow, and we
                are grateful to have you here. Happy shopping!
              </p>
              <p className={`${pClass} text-center`}>&mdash; Emily</p>
            </Section>
          </div>
        </div>
      </Container>
    </div>
  );
}
