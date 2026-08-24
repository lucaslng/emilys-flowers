import type { Metadata } from 'next';
import Container from '@/components/ui/Container';
import StarMotif from '@/components/ui/StarMotif';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Emily\u2019s Flowers collects, uses, and discloses your personal information when you visit emilysflowers.ca or make a purchase.',
  alternates: {
    canonical: '/privacy',
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

export default function PrivacyPolicyPage() {
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
              Privacy Policy
            </h1>
            <p className="mt-2 font-sans text-sm text-muted">Last updated: August 23, 2026</p>
          </div>

          <div className="mt-10 space-y-8">
            <Section>
              <p className={pClass}>
                This Privacy Policy describes how Emily&rsquo;s Flowers (the &ldquo;Site&rdquo;,
                &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) collects, uses, and
                discloses your personal information when you visit, use our services, or make a
                purchase from emilysflowers.ca (the &ldquo;Site&rdquo;) or otherwise communicate
                with us regarding the Site (collectively, the &ldquo;Services&rdquo;). For purposes
                of this Privacy Policy, &ldquo;you&rdquo; and &ldquo;your&rdquo; means you as the
                user of the Services, whether you are a customer, website visitor, or another
                individual whose information we have collected pursuant to this Privacy Policy.
              </p>
              <p className={pClass}>
                Please read this Privacy Policy carefully. By using and accessing any of the
                Services, you agree to the collection, use, and disclosure of your information as
                described in this Privacy Policy. If you do not agree to this Privacy Policy,
                please do not use or access any of the Services.
              </p>

              <h2 className={h3Class}>Changes to This Privacy Policy</h2>
              <p className={pClass}>
                We may update this Privacy Policy from time to time, including to reflect changes
                to our practices or for other operational, legal, or regulatory reasons. We will
                post the revised Privacy Policy on the Site, update the &ldquo;Last updated&rdquo;
                date and take any other steps required by applicable law.
              </p>
            </Section>

            <Section title="How We Collect and Use Your Personal Information">
              <p className={pClass}>
                To provide the Services, we collect personal information about you from a variety
                of sources, as set out below. The information that we collect and use varies
                depending on how you interact with us.
              </p>
              <p className={pClass}>
                In addition to the specific uses set out below, we may use information we collect
                about you to communicate with you, provide or improve the Services, comply with any
                applicable legal obligations, enforce any applicable terms of service, and to
                protect or defend the Services, our rights, and the rights of our users or others.
              </p>

              <h3 className={h3Class}>What Personal Information We Collect</h3>
              <p className={pClass}>
                The types of personal information we obtain about you depends on how you interact
                with our Site and use our Services. When we use the term &ldquo;personal
                information&rdquo;, we are referring to information that identifies, relates to,
                describes or can be associated with you. The following sections describe the
                categories and specific types of personal information we collect.
              </p>

              <h3 className={h3Class}>Information We Collect Directly from You</h3>
              <p className={pClass}>
                Information that you directly submit to us through our Services may include:
              </p>
              <ul className={ulClass}>
                <li>Contact details including your name, address, phone number, and email.</li>
                <li>
                  Order information including your name, billing address, shipping address, payment
                  confirmation, email address, and phone number.
                </li>
                <li>Shopping information including the items you view and put in your cart.</li>
                <li>
                  Customer support information including the information you choose to include in
                  communications with us, for example, when sending a message through the Services.
                </li>
              </ul>
              <p className={pClass}>
                Some features of the Services may require you to directly provide us with certain
                information about yourself. You may elect not to provide this information, but
                doing so may prevent you from using or accessing these features.
              </p>

              <h3 className={h3Class}>Information We Collect about Your Usage</h3>
              <p className={pClass}>
                We may automatically collect limited technical information about your interaction
                with the Services (&ldquo;Usage Data&rdquo;), such as your IP address, browser
                type, device information, and information about how you access and use the Site.
                This information is processed on our behalf by our hosting provider, Cloudflare, to
                operate, secure, and administer the Site (for example, to rate-limit abusive
                requests). We do not use advertising trackers or analytics tools.
              </p>

              <h3 className={h3Class}>Information We Obtain from Third Parties</h3>
              <p className={pClass}>
                Finally, we may obtain information about you from third parties, including from
                vendors and service providers who may collect information on our behalf, such as:
              </p>
              <ul className={ulClass}>
                <li>
                  Our payment processors, who collect payment information (e.g., bank account,
                  credit or debit card information, billing address) to process your payment in
                  order to fulfill your orders and provide you with products or services you have
                  requested, in order to perform our contract with you.
                </li>
              </ul>
              <p className={pClass}>
                Any information we obtain from third parties will be treated in accordance with
                this Privacy Policy. Also see the section below,{' '}
                <em>Third Party Websites and Links.</em>
              </p>

              <h3 className={h3Class}>How We Use Your Personal Information</h3>
              <ul className={ulClass}>
                <li>
                  <strong>Providing Products and Services.</strong> We use your personal
                  information to provide you with the Services in order to perform our contract
                  with you, including to process your payments, fulfill your orders, send you
                  notifications related to your purchases, returns, exchanges or other
                  transactions, arrange for shipping, and facilitate any returns and exchanges.
                  Payments are processed by our payment processor, Stripe. When you make a
                  purchase, Stripe collects and processes your payment information (such as credit
                  or debit card details) in accordance with Stripe&rsquo;s Privacy Policy.
                </li>
                <li>
                  <strong>Security and Fraud Prevention.</strong> We use your personal information
                  to detect, investigate or take action regarding possible fraudulent, illegal or
                  malicious activity.
                </li>
                <li>
                  <strong>Communicating with You and Service Improvement.</strong> We use your
                  personal information to provide you with customer support and improve our
                  Services. This is in our legitimate interests in order to be responsive to you,
                  to provide effective services to you, and to maintain our business relationship
                  with you.
                </li>
              </ul>
              <p className={pClass}>
                We do not use your personal information for marketing or advertising, and we do not
                sell your personal information.
              </p>
            </Section>

            <Section title="Local Storage">
              <p className={pClass}>
                We do not use advertising or analytics cookies. To remember the items in your
                shopping cart between visits, we store a small amount of information in your
                browser&rsquo;s local storage. This information stays on your device and is not
                used for tracking. You can clear it at any time through your browser settings;
                doing so will empty your cart.
              </p>
            </Section>

            <Section title="How We Disclose Personal Information">
              <p className={pClass}>
                In certain circumstances, we may disclose your personal information to third
                parties for contract fulfillment purposes, legitimate purposes and other reasons
                subject to this Privacy Policy. Such circumstances may include:
              </p>
              <ul className={ulClass}>
                <li>
                  With service providers who perform services on our behalf, including Stripe
                  (payment processing), ChitChats (shipping), Resend (delivery of order
                  confirmation and shipping emails), and Cloudflare (hosting and security). These
                  providers process your information on our behalf to fulfill your orders and
                  operate the Services.
                </li>
                <li>
                  In connection with a business transaction such as a merger or bankruptcy, to
                  comply with any applicable legal obligations (including to respond to subpoenas,
                  search warrants and similar requests), to enforce any applicable terms of
                  service, and to protect or defend the Services, our rights, and the rights of
                  our users or others.
                </li>
              </ul>

              <p className={pClass}>
                We disclose the following categories of personal information about users for the
                purposes set out above in <em>How We Collect and Use Your Personal
                Information</em> and <em>How We Disclose Personal Information</em>:
              </p>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full border-collapse text-left font-sans text-sm leading-relaxed">
                  <thead>
                    <tr>
                      <th className="border-b border-rose-line pb-2 pr-4 text-xs font-bold uppercase tracking-[0.08em] text-foreground">
                        Category
                      </th>
                      <th className="border-b border-rose-line pb-2 text-xs font-bold uppercase tracking-[0.08em] text-foreground">
                        Categories of Recipients
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-muted">
                    <tr>
                      <td className="border-b border-rose-line/40 p-3 pr-4 align-top">
                        Identifiers such as basic contact details and certain order information
                      </td>
                      <td className="border-b border-rose-line/40 p-3 align-top" rowSpan={3}>
                        Service providers who perform services on our behalf (payment processing,
                        shipping, email delivery, hosting and security)
                      </td>
                    </tr>
                    <tr>
                      <td className="border-b border-rose-line/40 p-3 pr-4 align-top">
                        Commercial information such as order information, shopping information and
                        customer support information
                      </td>
                    </tr>
                    <tr>
                      <td className="border-b border-rose-line/40 p-3 pr-4 align-top">
                        Internet or other similar network activity, such as Usage Data
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className={pClass}>
                We do not use or disclose sensitive personal information without your consent or
                for the purposes of inferring characteristics about you.
              </p>
            </Section>

            <Section title="Third Party Websites and Links">
              <p className={pClass}>
                Our Site may provide links to websites or other online platforms operated by third
                parties. If you follow links to sites not affiliated or controlled by us, you
                should review their privacy and security policies and other terms and conditions.
                We do not guarantee and are not responsible for the privacy or security of such
                sites, including the accuracy, completeness, or reliability of information found
                on these sites. Information you provide on public or semi-public venues, including
                information you share on third-party social networking platforms may also be
                viewable by other users of the Services and/or users of those third-party
                platforms without limitation as to its use by us or by a third party. Our
                inclusion of such links does not, by itself, imply any endorsement of the content
                on such platforms or of their owners or operators, except as disclosed on the
                Services.
              </p>

              <h2 className={h3Class}>Children&rsquo;s Data</h2>
              <p className={pClass}>
                The Services are not intended to be used by children, and we do not knowingly
                collect any personal information about children. If you are the parent or guardian
                of a child who has provided us with their personal information, you may contact us
                using the contact details set out below to request that it be deleted.
              </p>
              <p className={pClass}>
                As of the Effective Date of this Privacy Policy, we do not have actual knowledge
                that we &ldquo;share&rdquo; or &ldquo;sell&rdquo; (as those terms are defined in
                applicable law) personal information of individuals under 16 years of age.
              </p>

              <h2 className={h3Class}>Security and Retention of Your Information</h2>
              <p className={pClass}>
                Please be aware that no security measures are perfect or impenetrable, and we
                cannot guarantee &ldquo;perfect security.&rdquo; In addition, any information you
                send to us may not be secure while in transit. We recommend that you do not use
                insecure channels to communicate sensitive or confidential information to us.
              </p>
              <p className={pClass}>
                We keep your personal information only as long as needed for the purposes described
                in this Privacy Policy. Shopping cart contents stay in your browser&rsquo;s local
                storage until you clear them or complete your order. Order records are retained for
                up to seven years to meet tax, accounting, and other legal obligations. Customer
                support communications are kept as long as necessary to resolve your request.
              </p>
            </Section>

            <Section title="Your Rights">
              <p className={pClass}>
                Depending on where you live, you may have some or all of the rights listed below in
                relation to your personal information. However, these rights are not absolute, may
                apply only in certain circumstances and, in certain cases, we may decline your
                request as permitted by law.
              </p>
              <ul className={ulClass}>
                <li>
                  <strong>Right to Access / Know:</strong> You may have a right to request access
                  to personal information that we hold about you, including details relating to the
                  ways in which we use and share your information.
                </li>
                <li>
                  <strong>Right to Delete:</strong> You may have a right to request that we delete
                  personal information we maintain about you.
                </li>
                <li>
                  <strong>Right to Correct:</strong> You may have a right to request that we
                  correct inaccurate personal information we maintain about you.
                </li>
                <li>
                  <strong>Right of Portability:</strong> You may have a right to receive a copy of
                  the personal information we hold about you and to request that we transfer it to
                  a third party, in certain circumstances and with certain exceptions.
                </li>
                <li>
                  <strong>Restriction of Processing:</strong> You may have the right to ask us to
                  stop or restrict our processing of personal information.
                </li>
                <li>
                  <strong>Withdrawal of Consent:</strong> Where we rely on consent to process your
                  personal information, you may have the right to withdraw this consent.
                </li>
                <li>
                  <strong>Appeal:</strong> You may have a right to appeal our decision if we
                  decline to process your request. You can do so by replying directly to our
                  denial.
                </li>
                <li>
                  <strong>Managing Communication Preferences:</strong> We only send emails about
                  your orders, such as order confirmations and shipping updates. If we ever send
                  promotional emails in the future, we will obtain your consent first and include
                  an unsubscribe option you can use at any time.
                </li>
              </ul>
              <p className={pClass}>
                You may exercise any of these rights where indicated on our Site or by contacting
                us using the contact details provided below.
              </p>
              <p className={pClass}>
                We will not discriminate against you for exercising any of these rights. We may
                need to collect information from you to verify your identity, such as your email
                address or account information, before providing a substantive response to the
                request. In accordance with applicable laws, you may designate an authorized agent
                to make requests on your behalf to exercise your rights. Before accepting such a
                request from an agent, we will require that the agent provide proof you have
                authorized them to act on your behalf, and we may need you to verify your identity
                directly with us. We will respond to your request in a timely manner as required
                under applicable law.
              </p>
            </Section>

            <Section title="Complaints">
              <p className={pClass}>
                If you have complaints about how we process your personal information, please
                contact us using the contact details provided below. If you are not satisfied with
                our response to your complaint, depending on where you live you may have the right
                to appeal our decision by contacting us using the contact details set out below,
                or lodge your complaint with your local data protection authority.
              </p>

              <h2 className={h3Class}>Where Your Information Is Processed</h2>
              <p className={pClass}>
                Your personal information is primarily processed in Canada, including by ChitChats
                to arrange shipping for your orders. Some of our service providers process
                information in the United States: Stripe (payments), Cloudflare (hosting and
                security), and Resend (order emails).
              </p>
              <p className={pClass}>
                We require these service providers contractually to protect your personal
                information with safeguards comparable to those described in this Privacy Policy.
                Please note that personal information processed in another country may be accessed
                by the courts, law enforcement, and national security authorities of that country
                in accordance with their laws.
              </p>

              <h2 className={h3Class}>Contact</h2>
              <p className={pClass}>
                Should you have any questions about our privacy practices or this Privacy Policy,
                or if you would like to exercise any of the rights available to you, please email
                us at{' '}
                <a
                  href="mailto:contact@emilysflowers.ca"
                  className="underline decoration-rose-line underline-offset-4 hover:text-foreground"
                >
                  contact@emilysflowers.ca
                </a>
                .
              </p>
            </Section>
          </div>
        </div>
      </Container>
    </div>
  );
}
