import { Helmet } from "react-helmet-async";
import { Mail, MapPin, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StickyCTAFooter from "@/components/StickyCTAFooter";

export default function Contact() {
  const navigate = useNavigate();
  return (
    <>
      <Helmet>
        <title>Contact WindowMan | Quote Review Support</title>
        <meta
          name="description"
          content="Contact WindowMan for questions about impact-window quote reviews, uploaded estimates, privacy, and homeowner support."
        />
      </Helmet>
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
            Contact
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-5xl">
            Get in Touch
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
            Have questions about our quote analysis? Need help with your Truth
            Report? We're here to help South Florida homeowners.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {/* Main Contact Card */}
          <div className="md:col-span-2">
            <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-sm backdrop-blur-sm md:p-8">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                <Mail className="h-7 w-7 text-blue-600" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-gray-900">
                Email Us Directly
              </h2>
              <p className="mb-6 text-sm leading-6 text-gray-600">
                For support, account questions, or general inquiries about
                WindowMan.app and our forensic quote analysis tools, email our
                team directly.
              </p>
              <a
                href="mailto:support@windowman.app"
                className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800"
              >
                support@windowman.app
              </a>
              <p className="mt-4 text-xs text-gray-500">
                We typically respond within 24 hours.
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Region Card */}
            <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <MapPin className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-gray-900">
                Service Area
              </h3>
              <p className="text-sm text-gray-600">South Florida</p>
              <p className="mt-1 text-xs text-gray-500">
                Broward, Miami-Dade & Palm Beach Counties
              </p>
            </div>

            {/* Hours Card */}
            <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-gray-900">
                Support Hours
              </h3>
              <p className="text-sm text-gray-600">Mon–Fri: 9am–6pm EST</p>
              <p className="mt-1 text-xs text-gray-500">
                Quote analysis available 24/7
              </p>
            </div>
          </div>
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
    </>
  );
}
