import { WindowManIntakeRouter } from "./WindowManIntakeRouter";

/**
 * Production stage wrapper for the WindowMan intake router (live mode).
 *
 * Unlike `WindowManIntakePreview`, this has NO "visual lab" banner and NO
 * `noindex` meta — it is intended to render inside a real page (the About
 * direct-entry surface) behind feature flags. It only provides a centered
 * container; the router owns its own card chrome and mobile full-bleed layout.
 */
export function WindowManIntakeLive() {
  return (
    <div className="flex w-full justify-center">
      <div className="w-full max-w-md">
        <WindowManIntakeRouter mode="live" defaultOpen />
      </div>
    </div>
  );
}

export default WindowManIntakeLive;
