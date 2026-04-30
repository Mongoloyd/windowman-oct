/**
 * TwoChoices — renders the imported "WindowMan — The Market Maker" template
 * exactly as authored, served from /public/twochoices.html via an iframe so
 * its inline Tailwind CDN, custom CSS, and vanilla JS all run untouched.
 */
export default function TwoChoices() {
  return (
    <iframe
      src="/twochoices.html"
      title="WindowMan — The Market Maker"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: "none",
      }}
    />
  );
}
