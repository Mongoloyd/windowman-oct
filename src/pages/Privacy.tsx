import { Shield, Lock, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StickyCTAFooter from "@/components/StickyCTAFooter";

export default function Privacy() {
  const navigate = useNavigate();
  return (
    <main
      className="relative min-h-screen overflow-hidden pb-32"
      style={{
        background:
          "linear-gradient(170deg, #dce8f4 0%, #e4edf6 30%, #eaeff8 60%, #dde6f2 100%)",
      }}
    >
      <section className="mx-auto max-w-4xl px-4 py-16 md:px-8 md:py-24">
        <div className="mb-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
            Privacy Policy
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm leading-6 text-gray-500">
            Last updated: April 14, 2026
          </p>
        </div>

        {/* Security Highlight Box */}
        <div className="mb-10 rounded-2xl border border-blue-200/60 bg-blue-50/50 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100">
              <Shield className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                Your Data is Protected
              </h2>
              <p className="text-sm leading-6 text-gray-600">
                At WindowMan.app, your privacy is paramount.{" "}
                <strong className="text-gray-900">
                  All uploaded quotes are protected with industry-standard encryption
                </strong>
                , strictly confidential, and{" "}
                <strong className="text-gray-900">
                  never shared with the original contractor or third-party
                  marketing firms
                </strong>
                . We built this platform to empower homeowners — not to monetize
                your data.
              </p>
            </div>
          </div>
        </div>

        {/* Trust Icons */}
        <div className="mb-10 grid gap-4 md:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur-sm">
            <Lock className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">
              Encrypted in Transit & at Rest
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur-sm">
            <EyeOff className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">
              Never Shared with Contractors
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white/70 p-4 shadow-sm backdrop-blur-sm">
            <Shield className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">
              No Third-Party Marketing
            </span>
          </div>
        </div>

        {/* Policy Content */}
        <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-sm backdrop-blur-sm md:p-8">
          <article className="prose prose-slate max-w-none text-base leading-7 text-gray-600">
            <p>
              WindowMan.app ("we," "us," or "our") provides AI-assisted forensic
              quote analysis for homeowners evaluating impact window proposals
              in South Florida. This Privacy Policy explains how we collect,
              use, store, and protect your information.
            </p>

            <h2 className="mt-8 text-xl font-semibold text-gray-900">
              Information We Collect
            </h2>
            <p>
              We may collect information you provide directly, including your
              name, email address, phone number, property-related information,
              and documents you upload for analysis.
            </p>

            <h2 className="mt-8 text-xl font-semibold text-gray-900">
              How We Use Information
            </h2>
            <p>We use your information to:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Provide quote analysis and educational insights.</li>
              <li>Improve product performance and user experience.</li>
              <li>Respond to support requests and account inquiries.</li>
              <li>
                Connect you with vetted match contractors only if you
                explicitly choose to pursue that option.
              </li>
            </ul>

            <h2 className="mt-8 text-xl font-semibold text-gray-900">
              Document Security & Confidentiality
            </h2>
            <p>
              <strong>
                Your uploaded quotes are protected with industry-standard
                security safeguards
              </strong>{" "}
              including encryption in transit and at rest. Documents are stored
              in secure, access-controlled infrastructure with strict data
              isolation.
            </p>
            <p className="mt-4 rounded-lg border-l-4 border-blue-500 bg-blue-50 py-3 pl-4 pr-3 text-sm font-medium text-gray-700">
              <strong>Critical guarantee:</strong> We never share your uploaded
              quote with the original contractor who provided it. Your use of
              WindowMan.app is completely confidential — contractors will never
              know you scanned their quote.
            </p>

            <h2 className="mt-8 text-xl font-semibold text-gray-900">
              What We Don't Do
            </h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>We do not sell your personal information</strong> to
                data brokers or third-party marketing firms.
              </li>
              <li>
                <strong>We do not share your quote</strong> with the contractor
                who originally provided it.
              </li>
              <li>
                <strong>We do not use your data for advertising</strong> outside
                of our platform.
              </li>
              <li>
                <strong>We do not retain documents indefinitely</strong> —
                uploaded files are kept only in accordance with our data
                retention practices and can be deleted upon request.
              </li>
            </ul>

            <h2 className="mt-8 text-xl font-semibold text-gray-900">
              How We Share Information
            </h2>
            <p>
              We may share limited information with service providers who help
              us operate the platform, maintain infrastructure, deliver support,
              or process analytics. If you choose to be matched with a vetted
              contractor, we may share relevant contact details and project
              context to facilitate that connection —{" "}
              <strong>
                but only with your explicit consent and never with the original
                quoting contractor
              </strong>
              .
            </p>

            <h2 className="mt-8 text-xl font-semibold text-gray-900">
              Data Retention
            </h2>
            <p>
              We retain information for as long as reasonably necessary to
              provide the service, comply with legal obligations, resolve
              disputes, and enforce our agreements. You may request deletion of
              your data at any time.
            </p>

            <h2 className="mt-8 text-xl font-semibold text-gray-900">
              Your Choices
            </h2>
            <p>
              You may contact us to request access, correction, or deletion of
              certain information, subject to applicable law and operational
              limitations.
            </p>

            <h2 className="mt-8 text-xl font-semibold text-gray-900">
              Third-Party Services
            </h2>
            <p>
              Our platform may rely on third-party infrastructure, hosting,
              analytics, communications, and storage providers. Their handling
              of data is governed by their own terms and policies where
              applicable.
            </p>

            <h2 className="mt-8 text-xl font-semibold text-gray-900">
              Children's Privacy
            </h2>
            <p>
              WindowMan.app is not directed to children under 13, and we do not
              knowingly collect personal information from children under 13.
            </p>

            <h2 className="mt-8 text-xl font-semibold text-gray-900">
              Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. Continued use
              of the platform after changes become effective constitutes
              acceptance of the revised policy.
            </p>

            <h2 className="mt-8 text-xl font-semibold text-gray-900">
              Contact
            </h2>
            <p>
              Questions about this policy may be sent to{" "}
              <a
                href="mailto:support@windowman.app"
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                support@windowman.app
              </a>
              .
            </p>
          </article>
        </div>
      </section>
      <StickyCTAFooter
        isVisible={true}
        conversionType={null}
        onScanClick={() => navigate("/?action=scan")}
        onDemoClick={() => navigate("/?action=demo")}
        onPostConversionClick={() => { window.location.href = "tel:+15614685571"; }}
      />
    </main>
  );
}
