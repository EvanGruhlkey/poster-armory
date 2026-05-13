import { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for Poster Armory. Learn how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Last updated: March 18, 2026
          </p>

          <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-foreground [&_strong]:text-foreground">
            <section>
              <p>
                Poster Armory (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) respects
                your privacy and is committed to protecting the personal information you
                share with us. This Privacy Policy explains what information we collect, how
                we use it, and the choices you have regarding your data when you use our
                website and services at <strong>posterarmory.com</strong> (&quot;the
                Service&quot;).
              </p>
            </section>

            <section>
              <h2>1. Information We Collect</h2>

              <h3 className="mt-4">1.1 Information You Provide</h3>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  <strong>Account information:</strong> When you create an account, we
                  collect your email address and, if you sign in via Google, your name and
                  profile photo.
                </li>
                <li>
                  <strong>Poster configurations:</strong> The locations, text, themes, and
                  design settings you choose when creating posters.
                </li>
                <li>
                  <strong>Payment information:</strong> When you subscribe, payment details
                  (credit card number, billing address) are collected and processed directly
                  by Stripe. We do not store your full payment details on our servers — we
                  only receive a Stripe customer ID and subscription status.
                </li>
                <li>
                  <strong>Communications:</strong> If you contact us for support, we collect
                  the information you provide in your message.
                </li>
              </ul>

              <h3 className="mt-4">1.2 Information Collected Automatically</h3>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  <strong>Usage data:</strong> We track the number of poster designs and
                  downloads you generate each month for quota enforcement purposes.
                </li>
                <li>
                  <strong>Authentication cookies:</strong> We use cookies strictly for
                  maintaining your login session. We do not use tracking cookies, advertising
                  cookies, or third-party analytics cookies.
                </li>
                <li>
                  <strong>Server logs:</strong> Our hosting infrastructure may automatically
                  collect standard log data such as your IP address, browser type, and
                  request timestamps for security and operational purposes.
                </li>
              </ul>

              <h3 className="mt-4">1.3 Information from Third Parties</h3>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  <strong>Google OAuth:</strong> If you sign in with Google, we receive your
                  email address, display name, and profile photo from Google. We do not
                  access your Google contacts, files, or any other Google account data.
                </li>
              </ul>
            </section>

            <section>
              <h2>2. How We Use Your Information</h2>
              <p className="mt-3">We use the information we collect to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>Provide, maintain, and improve the Service.</li>
                <li>Process your poster designs and deliver downloadable files.</li>
                <li>Manage your account, subscription, and billing.</li>
                <li>Enforce usage limits and prevent abuse.</li>
                <li>Respond to your support requests and communications.</li>
                <li>
                  Ensure the security and integrity of the Service (fraud prevention, rate
                  limiting).
                </li>
              </ul>
              <p className="mt-2">
                We do <strong>not</strong> use your information for advertising, behavioral
                profiling, or selling to third parties.
              </p>
            </section>

            <section>
              <h2>3. How We Share Your Information</h2>
              <p className="mt-3">
                We do not sell, rent, or trade your personal information. We share data only
                with the following service providers, strictly as necessary to operate the
                Service:
              </p>

              <div className="mt-4 overflow-hidden rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 font-medium text-foreground">Provider</th>
                      <th className="px-4 py-2 font-medium text-foreground">Purpose</th>
                      <th className="px-4 py-2 font-medium text-foreground">Data Shared</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="px-4 py-2">
                        <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Supabase</a>
                      </td>
                      <td className="px-4 py-2">Authentication, database, file storage</td>
                      <td className="px-4 py-2">Account data, poster configs, generated files</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">
                        <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Stripe</a>
                      </td>
                      <td className="px-4 py-2">Payment processing</td>
                      <td className="px-4 py-2">Email, payment method, billing address</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Google</a>
                      </td>
                      <td className="px-4 py-2">OAuth sign-in (optional)</td>
                      <td className="px-4 py-2">Authentication tokens only</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">
                        <a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">OpenStreetMap / Nominatim</a>
                      </td>
                      <td className="px-4 py-2">Geocoding (location search)</td>
                      <td className="px-4 py-2">Search queries (city names, addresses)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="mt-4">
                We may also disclose information if required by law, regulation, legal
                process, or governmental request, or to protect the rights, safety, or
                property of our users or the public.
              </p>
            </section>

            <section>
              <h2>4. Cookies</h2>
              <p className="mt-3">
                We use <strong>essential cookies only</strong>. These cookies are necessary
                to maintain your authenticated session and are set by our authentication
                provider (Supabase). They do not track your activity across other websites.
              </p>
              <p className="mt-2">
                We do not use analytics cookies, advertising cookies, or any third-party
                tracking technologies.
              </p>
            </section>

            <section>
              <h2>5. Data Retention</h2>
              <ul className="mt-3 list-disc space-y-1 pl-6">
                <li>
                  <strong>Account data:</strong> Retained for the lifetime of your account.
                  Deleted upon account deletion.
                </li>
                <li>
                  <strong>Poster designs and files:</strong> Stored as long as your account
                  is active. Generated files are stored in secure cloud storage.
                </li>
                <li>
                  <strong>Usage records:</strong> Retained for billing and quota tracking
                  purposes. Historical records may be kept for up to 12 months after account
                  closure for accounting and legal compliance.
                </li>
                <li>
                  <strong>Payment records:</strong> Managed by Stripe in accordance with
                  their retention policies and applicable financial regulations.
                </li>
              </ul>
            </section>

            <section>
              <h2>6. Data Security</h2>
              <p className="mt-3">
                We implement appropriate technical and organizational measures to protect
                your personal information, including:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>Encrypted data transmission (HTTPS/TLS) for all connections.</li>
                <li>Secure authentication with hashed passwords and OAuth tokens.</li>
                <li>Row-level security policies on our database ensuring users can only access their own data.</li>
                <li>Rate limiting to prevent abuse and unauthorized access attempts.</li>
                <li>Payment data handled exclusively by PCI-DSS compliant Stripe infrastructure.</li>
              </ul>
              <p className="mt-2">
                While we take reasonable precautions, no method of transmission over the
                internet or electronic storage is 100% secure. We cannot guarantee absolute
                security.
              </p>
            </section>

            <section>
              <h2>7. Your Rights</h2>
              <p className="mt-3">
                Depending on your location, you may have the following rights regarding
                your personal data:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-6">
                <li>
                  <strong>Access:</strong> Request a copy of the personal data we hold about
                  you.
                </li>
                <li>
                  <strong>Correction:</strong> Request correction of inaccurate or
                  incomplete data.
                </li>
                <li>
                  <strong>Deletion:</strong> Request deletion of your personal data and
                  account.
                </li>
                <li>
                  <strong>Portability:</strong> Request your data in a portable format.
                </li>
                <li>
                  <strong>Objection:</strong> Object to processing of your data in certain
                  circumstances.
                </li>
              </ul>
              <p className="mt-2">
                To exercise any of these rights, contact us at{" "}
                <a
                  href="mailto:posterarmory@gmail.com"
                  className="underline hover:text-foreground"
                >
                  posterarmory@gmail.com
                </a>
                . We will respond to your request within 30 days.
              </p>

              <h3 className="mt-4">California Residents (CCPA)</h3>
              <p className="mt-2">
                If you are a California resident, you have the right to know what personal
                information we collect and how it is used, to request deletion of your
                personal information, and to opt out of the sale of your data. We do not
                sell personal information.
              </p>

              <h3 className="mt-4">European Residents (GDPR)</h3>
              <p className="mt-2">
                If you are located in the European Economic Area (EEA), the legal basis for
                collecting and using your personal information is: (a) your consent when
                creating an account, (b) performance of a contract when providing the
                Service, and (c) our legitimate interests in operating and securing the
                Service.
              </p>
            </section>

            <section>
              <h2>8. Children&apos;s Privacy</h2>
              <p className="mt-3">
                The Service is not directed at children under 16 years of age. We do not
                knowingly collect personal information from children under 16. If we become
                aware that we have collected data from a child under 16, we will take steps
                to delete that information promptly.
              </p>
            </section>

            <section>
              <h2>9. International Data Transfers</h2>
              <p className="mt-3">
                Your information may be transferred to and processed in countries other
                than your own. Our service providers (Supabase, Stripe) may store data in
                data centers located in the United States or other jurisdictions. By using
                the Service, you consent to the transfer of your data to these locations.
                We ensure that all transfers comply with applicable data protection laws.
              </p>
            </section>

            <section>
              <h2>10. Changes to This Policy</h2>
              <p className="mt-3">
                We may update this Privacy Policy from time to time. Material changes will
                be communicated by updating the &quot;Last updated&quot; date at the top of
                this page. We encourage you to review this page periodically for the latest
                information on our privacy practices.
              </p>
            </section>

            <section>
              <h2>11. Contact Us</h2>
              <p className="mt-3">
                If you have questions, concerns, or requests regarding this Privacy Policy
                or your personal data, please contact us at:
              </p>
              <p className="mt-2">
                <a
                  href="mailto:posterarmory@gmail.com"
                  className="underline hover:text-foreground"
                >
                  posterarmory@gmail.com
                </a>
              </p>
            </section>

            <section className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs">
                This Privacy Policy should be read alongside our{" "}
                <Link href="/terms" className="underline hover:text-foreground">
                  Terms of Service
                </Link>
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
