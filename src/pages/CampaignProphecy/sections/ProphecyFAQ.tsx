import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "Is WindowMan a window contractor?",
    a: "No. WindowMan is independent software. We don't manufacture, sell or install windows or doors, and we're not a law firm, insurer, government agency or building department. We review written estimates so homeowners can understand what they're being asked to sign.",
  },
  {
    q: "How do you make money if this is free for me?",
    a: "Contractors pay us when a homeowner asks to be introduced to one. You are never charged, and nothing about your review changes based on who pays us — the review is produced before any introduction is offered, and you can decline it.",
  },
  {
    q: "I don't have an estimate yet. Is this still for me?",
    a: "Yes — that's the second path. We help you get a first written estimate from a contractor worth talking to, then review it free once it arrives. There's no obligation to hire anyone.",
  },
  {
    q: "Will I get spammed by ten contractors?",
    a: "No. We don't sell your details to a lead pool. You'll hear from WindowMan about your own request, and a contractor only ever gets your contact details if you specifically ask for an introduction.",
  },
  {
    q: "What do you need from me to read an estimate?",
    a: "The written estimate itself — a PDF or clear photos of the pages — plus your name, mobile number and email so we can send the results back to you.",
  },
] as const;

export default function ProphecyFAQ() {
  return (
    <section className="relative px-5 py-16 [content-visibility:auto] [contain-intrinsic-size:auto_560px] sm:px-8 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
          Straight answers
        </p>
        <h2 className="mt-3 text-[28px] font-bold leading-[1.15] text-white sm:text-[34px]">
          Before you give us your number.
        </h2>

        <Accordion type="single" collapsible className="mt-8 w-full">
          {FAQS.map((faq, index) => (
            <AccordionItem
              key={faq.q}
              value={`faq-${index}`}
              className="border-white/10"
            >
              <AccordionTrigger className="text-left text-[15.5px] font-semibold text-white hover:no-underline">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-[14.5px] leading-relaxed text-slate-400">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
