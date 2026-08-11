export default function SampleFindings() {
  return (
    <section>
      <div className="wrap">
        <div className="sec-head center" style={{ maxWidth: "660px" }}>
          <div className="sec-eyebrow">What a finding looks like</div>
          <h2>Specific, sourced, and worth asking about.</h2>
          <p className="sec-sub">WindowMan doesn't accuse anyone of anything. It points at the line and tells you what to ask.</p>
        </div>

        <div style={{ textAlign: "center" }}><span className="illus">Illustrative examples — not real estimates</span></div>

        <div className="findings">
          <div className="finding">
            <span className="pill pill-warn">Missing detail</span>
            <h4>No product approval number listed</h4>
            <p>The estimate names a window brand but no Florida product approval or NOA number. Worth asking which exact series is being installed and requesting the approval number in writing.</p>
          </div>
          <div className="finding">
            <span className="pill pill-bad">Unclear line item</span>
            <h4>"Miscellaneous / job costs — $2,4XX"</h4>
            <p>A bundled charge with no breakdown may indicate permit, disposal, or finish work is included — or that it isn't. Worth requesting an itemized version before signing.</p>
          </div>
          <div className="finding">
            <span className="pill pill-good">Payment terms to review</span>
            <h4>Deposit payment schedule to review</h4>
            <p>Worth confirming when each payment is due and what work or materials each milestone covers before signing.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
