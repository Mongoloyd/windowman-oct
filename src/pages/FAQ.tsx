import { Helmet } from "react-helmet-async";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const faqs = [
  {
    id: "what-is-windowman",
    question: "What is WindowMan?",
    answer:
      "WindowMan helps Florida homeowners review impact-window quotes before signing. You upload your quote and receive an informational review that highlights scope, pricing context, and questions worth asking — so you can make a more informed decision before committing to a contract.",
  },
  {
    id: "is-contractor",
    question: "Is WindowMan a contractor?",
    answer:
      "No. WindowMan is not a contractor, licensed installer, law firm, building department, insurance advisor, or public adjuster. We provide informational quote review to help homeowners understand what they are being quoted — not installation, permitting, or professional advisory services.",
  },
  {
    id: "marketplace",
    question: "Is WindowMan a contractor marketplace or lead resale page?",
    answer:
      "No. WindowMan is a quote-review tool, not a contractor marketplace or lead resale page. We do not sell your contact information to data brokers, and we do not send your uploaded quote back to the original contractor as part of the review.",
  },
  {
    id: "after-upload",
    question: "What happens after I upload a quote?",
    answer:
      "After you upload, WindowMan scans and reviews your quote, then shows a preview of key findings. To unlock the full Truth Report, you complete a one-time SMS verification step. The report is yours to review before you sign — there is no obligation to request contractor introductions.",
  },
  {
    id: "free-for-homeowners",
    question: "Is WindowMan free for homeowners?",
    answer:
      "Yes. The quote review path is free for homeowners. There is no charge to upload your quote and receive your Truth Report. If you later request help finding a contractor, WindowMan may earn a referral fee from a contractor introduced through our network — but the review itself remains free and you are never required to use that option.",
  },
  {
    id: "no-guarantees",
    question: "Does WindowMan guarantee savings or outcomes?",
    answer:
      "No. WindowMan does not guarantee savings, code compliance, insurance outcomes, legal outcomes, or contractor performance. Our review is informational and designed to help you ask better questions. Independently verify contract terms, permitting, product approvals, and pricing with qualified professionals before signing.",
  },
  {
    id: "data-brokers",
    question: "Do you sell my personal information to data brokers?",
    answer:
      "No. WindowMan does not sell your personal information to data brokers. Your uploaded quote is not shared with the original contractor. We may share limited contact details with an introduced contractor only if you explicitly request that introduction. See our Privacy Policy for full details.",
  },
  {
    id: "cost",
    question: "How much does the scan cost?",
    answer:
      "100% Free for homeowners. There is no charge to upload your quote and receive your Truth Report. We believe every homeowner deserves clarity before signing a major contract.",
  },
  {
    id: "confidential",
    question: "Will my contractor know I scanned their quote?",
    answer:
      "No, completely confidential. Your uploaded quotes are processed securely and are never shared with the original contractor. We use 256-bit encryption and strict access controls to ensure your privacy.",
  },
  {
    id: "revenue",
    question: "How does WindowMan make money?",
    answer:
      "We take a transparent referral fee if you choose to work with one of our vetted partners, but the audit is always free. You are never obligated to use our partner network — the Truth Report is yours to keep regardless.",
  },
  {
    id: "areas",
    question: "What areas do you serve?",
    answer:
      "Currently serving South Florida, with a focus on Broward County. We are actively expanding to other hurricane-prone regions and plan to cover additional Florida counties soon.",
  },
  {
    id: "accuracy",
    question: "How accurate is the AI?",
    answer:
      "Our analysis engine benchmarks quote details against local county and market reference points to surface inconsistencies, omissions, and pricing context. It is designed to improve clarity, not replace human judgment.",
  },
  {
    id: "advice",
    question: "Is this legal or engineering advice?",
    answer:
      "No. WindowMan provides AI-assisted educational analysis and estimate guidance. It is not legal, financial, insurance, or structural engineering advice. Always consult qualified professionals for binding decisions.",
  },
];

export default function FAQ() {
  return (
    <>
      <Helmet>
        <title>WindowMan FAQ | Quote Review Questions</title>
        <meta
          name="description"
          content="Answers to common questions about WindowMan, impact-window quote reviews, privacy, verification, contractor introductions, and what the service does not guarantee."
        />
      </Helmet>
      <main
        className="relative min-h-screen overflow-hidden"
        style={{
          background:
            "linear-gradient(170deg, #dce8f4 0%, #e4edf6 30%, #eaeff8 60%, #dde6f2 100%)",
        }}
      >
        <section className="mx-auto max-w-4xl px-4 py-16 md:px-8 md:py-24">
          <div className="mb-10">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-gray-500">
              FAQ
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-5xl">
              Common Questions
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
              Everything you need to know about WindowMan and how our free quote
              review works.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-sm backdrop-blur-sm md:p-8">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((item) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="border-b border-slate-200/60 last:border-b-0"
                >
                  <AccordionTrigger className="py-5 text-left text-base font-medium text-gray-900 hover:no-underline md:text-lg">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-sm leading-7 text-gray-600 md:text-base">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </main>
    </>
  );
}
