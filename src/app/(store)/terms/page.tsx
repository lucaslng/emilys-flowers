import type { Metadata } from 'next';
import Container from '@/components/ui/Container';
import StarMotif from '@/components/ui/StarMotif';
import PageWash from '@/components/ui/PageWash';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service for using emilysflowers.ca and ordering from Emily\u2019s Flowers.',
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

const mailLink = (
  <a
    href="mailto:contact@emilysflowers.ca"
    className="underline decoration-rose-line underline-offset-4 hover:text-foreground"
  >
    contact@emilysflowers.ca
  </a>
);

export default function TermsOfServicePage() {
  return (
    <div className="relative isolate overflow-hidden py-16 sm:py-24">
      <PageWash background="radial-gradient(ellipse 50% 40% at 50% 15%, rgba(249, 228, 228, 0.45), rgba(254, 250, 245, 0) 70%)" />

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
                Thank you for visiting Emily's Flowers! We kindly ask all our customers to review our terms before placing an order.
              </p>
              <p className={pClass}>
                For how we handle your personal information, see our{' '}
                <a
                  href="/privacy"
                  className="underline decoration-rose-line underline-offset-4 hover:text-foreground"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </Section>

            <Section title="Our Flowers">
              <p className={pClass}>
                Every item is made by hand, one petal at a time. That means no two pieces are
                exactly alike. Tiny variations in color, size, and shape are part of the
                charm, not defects. We photograph everything with care, but colors can look a
                little different depending on your screen.
              </p>
            </Section>

            <Section title="Ordering and Payment">
              <p className={pClass}>
                Prices are in Canadian dollars. Checkout is handled securely by Stripe. Once your order goes through, you&rsquo;ll get a
                confirmation email as your receipt.
              </p>
              <p className={pClass}>
                If something is out of stock or an order looks off (like a pricing mistake), we may choose to 
                cancel it and refund you in full.
              </p>
            </Section>

            <Section title="Shipping">
              <p className={pClass}>
                Orders ship via ChitChats. Shipping costs show up at checkout before you pay.
                Any delivery timelines we share are estimates, not guarantees.
              </p>
              <p className={pClass}>
                Please double-check your shipping address before ordering. We are not liable for incorrect shipping addresses.
              </p>
            </Section>

            <Section title="Returns and Refunds">
              <p className={pClass}>
                <strong>All Sales Are Final:</strong> Once an order is confirmed and payment is
                processed, no cancellations, returns, or refunds will be accepted.
              </p>
              <p className={pClass}>
                Because everything is handmade to order, please give your cart and shipping details
                a final look before checking out. This doesn&rsquo;t affect any rights you have
                under Canadian consumer protection law.
              </p>
            </Section>
            <Section>
              <div className="flex justify-center" aria-hidden="true">
                <span className="text-lg text-rose-line">&#10047;</span>
              </div>
              <p className={`${pClass} text-center`}>
                Thank you so much for supporting Emily's Flowers. Every order genuinely makes my day!
              </p>
              <p className={`${pClass} text-center`}>- Emily</p>
            </Section>
          </div>
        </div>
      </Container>
    </div>
  );
}
