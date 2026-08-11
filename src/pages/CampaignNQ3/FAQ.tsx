const questions = [
  {
    question: "Is WindowMan a window contractor?",
    answer: "No. WindowMan is independent software. We don't manufacture, sell, or install windows or doors, and we're not a law firm, insurer, government agency, or building department. We review written estimates so homeowners can understand what they're being asked to sign.",
  },
  {
    question: "How do you make money if this is free for me?",
    answer: "Contractors pay to receive homeowner requests. That's exactly why the review is built the way it is: the same analysis rules apply regardless of who produced the estimate, and the same kinds of unclear terms are flagged whether the contractor is in our network or not.",
  },
  {
    question: "What does the sample estimate rank mean?",
    answer: "The sample shows how an estimate's price and scope could be placed in context alongside comparable Florida projects. It's an illustration, not an appraisal — final pricing always depends on your specific home, and a contractor still has to verify site conditions in person.",
  },
  {
    question: "Will I get spammed by ten contractors?",
    answer: "No. You control how many estimates you want. We follow up about your project and the next step — you decide whether to move forward, and you can stop at any time.",
  },
];

export default function FAQ() {
  return (
    <section>
      <div className="wrap">
        <div className="sec-head center" style={{ maxWidth: "620px" }}>
          <div className="sec-eyebrow">Straight answers</div>
          <h2>Before you give us your number</h2>
        </div>
        <div className="faq">
          {questions.map((item, index) => (
            <details key={item.question} open={index === 0 ? true : undefined}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
