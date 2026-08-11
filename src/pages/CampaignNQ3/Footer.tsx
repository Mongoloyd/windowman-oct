export default function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-in">
          <div>© 2026 WindowMan. Independent quote intelligence.</div>
          <div className="foot-links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/disclaimer">Disclaimer</a>
          </div>
        </div>
        <p className="disclaimer">
          WindowMan is independent software and is not an installing contractor, window manufacturer, law firm,
          insurance company, government agency, or building department. Analysis is informational and based on the
          written estimate provided; it is not an appraisal, inspection, legal advice, or a guarantee of savings.
          Final pricing and scope remain subject to contractor field verification and the signed construction agreement.
        </p>
      </div>
    </footer>
  );
}
