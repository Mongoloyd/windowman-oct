import { useState, useEffect } from "react";
import { Phone, Users } from "lucide-react";
import { CTA_LABEL } from "@/components/post-scan/ctaConstants";

interface StickyCTAFooterProps {
  onScanClick: () => void;
  onDemoClick: () => void;
  onPostConversionClick: () => void;
  isVisible: boolean;
  conversionType: "scan" | "account" | null;
}

export const StickyCTAFooter = ({
  onScanClick,
  onDemoClick,
  onPostConversionClick,
  isVisible,
  conversionType,
}: StickyCTAFooterProps) => {
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    let scrollTimeout: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      setIsScrolling(true);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => setIsScrolling(false), 300);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  if (!isVisible) return null;

  // In full-report mode (conversionType === "scan"), mirror the in-page
  // primary CTA exactly: same wording (CTA_LABEL), same handler upstream.
  // In account-only mode, route to a free estimate request.
  const postConversionText =
    conversionType === "account"
      ? "Request a Free Estimate"
      : conversionType === "scan"
        ? CTA_LABEL
        : null;
  const PostConversionIcon = conversionType === "scan" ? Users : Phone;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card p-3 px-4 transition-opacity duration-150 ${isScrolling ? "opacity-25 hover:opacity-100" : "opacity-100"}`}
      style={{ boxShadow: "var(--shadow-shelf-up)" }}
    >
      <div className="max-w-5xl mx-auto flex items-center justify-center md:justify-between w-full">
        {conversionType ? (
          <div className="flex justify-center w-full">
            <button
              onClick={onPostConversionClick}
              className="w-full max-w-[320px] flex items-center justify-center gap-2 btn-depth-primary text-base font-semibold"
              style={{ padding: "12px 20px", minHeight: 48 }}
            >
              <PostConversionIcon size={18} />
              {postConversionText}
            </button>
          </div>
        ) : (
          <>
            <p className="hidden md:block text-sm font-medium text-muted-foreground">
              Don't Sign Until You've Got Your Free WindowMan AI Truth Report →
            </p>
            <div className="flex justify-center gap-3 w-full md:w-auto">
              <button
                onClick={onScanClick}
                className="flex-1 md:flex-none w-full max-w-[200px] btn-depth-primary"
                style={{ padding: "12px 20px", fontSize: 14 }}
              >
                Scan My Quote
              </button>
              <div className="flex flex-1 md:flex-none w-full max-w-[200px] rounded-xl bg-gradient-to-tr from-orange-400 to-blue-400 p-[2px] shadow-lg transition-transform hover:-translate-y-0.5">
                <button
                  onClick={onDemoClick}
                  className="flex-1 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-900"
                >
                  View Live Demo
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StickyCTAFooter;
