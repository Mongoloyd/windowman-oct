export default function HowItWorks() {
  return (
    <section className="sec-how">
      <div className="wrap">
        <div className="sec-head">
          <div className="sec-eyebrow">How it works</div>
          <h2>One estimate isn't a price. It's an opening offer.</h2>
          <p className="sec-sub">
            Most homeowners sign the first number they're shown because they have nothing to compare
            it to. WindowMan closes that gap, then keeps going until the number makes sense to you.
          </p>
        </div>

        <div className="steps">
          <div className="step">
            <div className="step-n">01</div>
            <h3>Get your first estimate</h3>
            <p>Tell us your ZIP and project. We help you take the next step toward a written estimate from a contractor in your area.</p>
          </div>
          <div className="step">
            <div className="step-n">02</div>
            <h3>See where it ranks</h3>
            <p>Once a written estimate exists, WindowMan reviews its price, scope, fees, warranty, and fine print so you can identify the questions worth asking.</p>
          </div>
          <div className="step">
            <div className="step-n">03</div>
            <h3>Go back with better questions</h3>
            <p>If something looks off, you'll know exactly what to ask — and we can help you line up another estimate to compare against.</p>
          </div>
        </div>

        <div className="loop-note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
          <span><b>Repeat as many times as you want.</b> There's no limit on how many estimates you can have checked.</span>
        </div>
      </div>
    </section>
  );
}
