import { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Poster Armory, a custom map art poster service.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: March 18, 2026
          </p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-foreground [&_strong]:text-foreground">
            <section>
              <h2>1. Agreement to Terms</h2>
              <p className="mt-3">
                By accessing or using Poster Armory (&quot;the Service&quot;), operated at{" "}
                <strong>posterarmory.com</strong>, you agree to be bound by these Terms of
                Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not
                access or use the Service.
              </p>
              <p className="mt-2">
                We may update these Terms from time to time. If we make material changes, we
                will notify you by updating the date at the top of this page. Your continued
                use of the Service after changes are posted constitutes acceptance of the
                revised Terms.
              </p>
            </section>

            <section>
              <h2>2. Description of Service</h2>
              <p className="mt-3">
                Poster Armory is a web-based platform that allows users to create custom map
                art posters. Users select a geographic location, customize the design (theme,
                text, size, and layout), generate a preview, and download high-resolution
                print-ready files in various formats (PNG, PDF, SVG depending on plan).
              </p>
              <p className="mt-2">
                Map data used in poster generation is sourced from OpenStreetMap and is
                subject to the{" "}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  OpenStreetMap license
                </a>
                .
              </p>
            </section>

            <section>
              <h2>3. Account Registration</h2>
              <p className="mt-3">
                To use the Service, you must create an account using a valid email address
                or by signing in through Google. You agree to:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>Provide accurate, current, and complete registration information.</li>
                <li>Maintain the security of your account credentials.</li>
                <li>
                  Accept responsibility for all activity that occurs under your account.
                </li>
                <li>Notify us immediately of any unauthorized access or use.</li>
              </ul>
              <p className="mt-2">
                You must be at least 16 years of age to create an account and use the
                Service.
              </p>
            </section>

            <section>
              <h2>4. Subscriptions and Billing</h2>

              <h3 className="mt-4">4.1 Plans and Pricing</h3>
              <p className="mt-2">
                The Service offers multiple subscription tiers with varying features,
                design limits, and download quotas. Current pricing is listed on our{" "}
                <Link href="/pricing" className="underline hover:text-foreground">
                  Pricing page
                </Link>
                . Prices are in US dollars and may change with notice.
              </p>

              <h3 className="mt-4">4.2 Payment Processing</h3>
              <p className="mt-2">
                All payments are processed securely through{" "}
                <a
                  href="https://stripe.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Stripe
                </a>
                . We do not store your credit card or payment details on our servers. By
                subscribing, you agree to Stripe&apos;s{" "}
                <a
                  href="https://stripe.com/legal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Terms of Service
                </a>
                .
              </p>

              <h3 className="mt-4">4.3 Recurring Billing</h3>
              <p className="mt-2">
                Subscriptions are billed on a recurring monthly basis. Your subscription
                will automatically renew at the end of each billing period unless cancelled
                before the renewal date.
              </p>

              <h3 className="mt-4">4.4 Cancellation</h3>
              <p className="mt-2">
                You may cancel your subscription at any time from your{" "}
                <Link href="/app/billing" className="underline hover:text-foreground">
                  Billing page
                </Link>
                . Upon cancellation, you will retain access to your plan&apos;s features
                until the end of the current billing period. No prorated refunds are issued
                for partial months.
              </p>

              <h3 className="mt-4">4.5 Plan Changes</h3>
              <p className="mt-2">
                You may upgrade or downgrade your plan at any time. When switching plans,
                your previous subscription is cancelled and the new plan takes effect
                immediately.
              </p>
            </section>

            <section>
              <h2>5. Usage Limits and Fair Use</h2>
              <p className="mt-3">
                Each subscription tier includes monthly limits on poster designs (previews)
                and high-resolution downloads. These limits reset at the beginning of each
                calendar month.
              </p>
              <p className="mt-2">
                Plans advertised as &quot;unlimited&quot; are subject to a fair use policy.
                Automated, scripted, or bulk generation that exceeds reasonable personal or
                commercial use may result in rate limiting or account suspension.
              </p>
            </section>

            <section>
              <h2>6. Intellectual Property</h2>

              <h3 className="mt-4">6.1 Your Content</h3>
              <p className="mt-2">
                You retain ownership of the poster designs you create using the Service,
                including the specific configuration choices (text, layout, color theme)
                you apply. You are granted a perpetual license to use, print, sell, and
                distribute the posters you create.
              </p>

              <h3 className="mt-4">6.2 Map Data</h3>
              <p className="mt-2">
                The underlying map data is sourced from OpenStreetMap and is available
                under the{" "}
                <a
                  href="https://opendatacommons.org/licenses/odbl/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Open Data Commons Open Database License (ODbL)
                </a>
                . When redistributing or selling posters, you should provide appropriate
                attribution to OpenStreetMap contributors.
              </p>

              <h3 className="mt-4">6.3 Our Service</h3>
              <p className="mt-2">
                The Poster Armory name, logo, design templates, themes, website design,
                and underlying software are the intellectual property of Poster Armory and
                are protected by applicable copyright and trademark laws. You may not copy,
                modify, or reverse-engineer the Service.
              </p>
            </section>

            <section>
              <h2>7. Acceptable Use</h2>
              <p className="mt-3">You agree not to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  Use the Service for any unlawful purpose or in violation of any applicable
                  laws.
                </li>
                <li>
                  Attempt to gain unauthorized access to the Service, other accounts, or
                  related systems.
                </li>
                <li>
                  Use automated scripts, bots, or scraping tools to interact with the
                  Service.
                </li>
                <li>
                  Interfere with or disrupt the Service&apos;s infrastructure or other
                  users&apos; use.
                </li>
                <li>
                  Resell, sublicense, or redistribute the Service itself (you may sell
                  posters you create).
                </li>
                <li>
                  Circumvent usage limits, rate limits, or access controls.
                </li>
              </ul>
            </section>

            <section>
              <h2>8. Availability and Modifications</h2>
              <p className="mt-3">
                We strive to keep the Service available and reliable but do not guarantee
                uninterrupted access. We reserve the right to modify, suspend, or
                discontinue any aspect of the Service at any time with reasonable notice.
                Scheduled maintenance will be communicated in advance when possible.
              </p>
            </section>

            <section>
              <h2>9. Termination</h2>
              <p className="mt-3">
                We may suspend or terminate your account if you violate these Terms or
                engage in conduct that is harmful to other users or the Service. You may
                delete your account at any time by contacting us. Upon termination, your
                right to use the Service ceases immediately, though previously downloaded
                poster files remain yours.
              </p>
            </section>

            <section>
              <h2>10. Disclaimer of Warranties</h2>
              <p className="mt-3">
                The Service is provided on an &quot;as is&quot; and &quot;as
                available&quot; basis without warranties of any kind, either express or
                implied, including but not limited to implied warranties of
                merchantability, fitness for a particular purpose, or non-infringement. We
                do not warrant that the Service will be error-free, secure, or available at
                all times.
              </p>
            </section>

            <section>
              <h2>11. Limitation of Liability</h2>
              <p className="mt-3">
                To the maximum extent permitted by applicable law, Poster Armory and its
                operators shall not be liable for any indirect, incidental, special,
                consequential, or punitive damages, or any loss of profits, data, or
                goodwill, arising from your use of or inability to use the Service. Our
                total liability for any claim related to the Service shall not exceed the
                amount you paid us in the twelve (12) months preceding the claim.
              </p>
            </section>

            <section>
              <h2>12. Indemnification</h2>
              <p className="mt-3">
                You agree to indemnify, defend, and hold harmless Poster Armory and its
                operators from and against any claims, damages, losses, or expenses
                (including reasonable legal fees) arising from your use of the Service,
                your violation of these Terms, or your violation of any rights of another
                party.
              </p>
            </section>

            <section>
              <h2>13. Governing Law</h2>
              <p className="mt-3">
                These Terms shall be governed by and construed in accordance with the laws
                of the United States. Any disputes arising from these Terms or the Service
                shall be resolved through good-faith negotiation, and if necessary, through
                binding arbitration.
              </p>
            </section>

            <section>
              <h2>14. Contact</h2>
              <p className="mt-3">
                If you have questions about these Terms, please contact us at{" "}
                <a
                  href="mailto:posterarmory@gmail.com"
                  className="underline hover:text-foreground"
                >
                  posterarmory@gmail.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
