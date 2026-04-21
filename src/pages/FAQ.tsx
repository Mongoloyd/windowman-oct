import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const faqs = [
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
      "Our analysis engine benchmarks quote details against thousands of local county and market reference points to surface inconsistencies, omissions, and pricing context. It is designed to improve clarity, not replace human judgment.",
  },
  {
    id: "advice",
    question: "Is this legal or engineering advice?",
    answer:
      "No. WindowMan.app provides AI-assisted educational analysis and estimate guidance. It is not legal, financial, insurance, or structural engineering advice. Always consult licensed professionals for binding decisions.",
  },
];

export default function FAQ() {
  return (
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
            Everything you need to know about WindowMan.app and how our free
            quote analysis works.
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
  );
}
