import { Component, Suspense, lazy, useRef, useState, type ReactNode } from "react";
import type { SyntheticDemoLauncherProps } from "./types";

const SyntheticDemo = lazy(() => import("./SyntheticDemo"));
class DemoLoadBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? (
      <div role="alert" className="mt-3 text-sm">
        The sample could not load. Please close it and try again.
        <button type="button" className="ml-2 min-h-11 underline" onClick={this.props.onClose}>Close sample</button>
      </div>
    ) : this.props.children;
  }
}

/** The host owns the trigger; the heavy engine is imported only after activation. */
export default function SyntheticDemoLauncher({ renderTrigger, ...props }: SyntheticDemoLauncherProps) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  return <>
    {renderTrigger({
      onClick: (event) => {
        openerRef.current = event.currentTarget;
        setOpen(true);
      },
      "aria-haspopup": "dialog", "aria-expanded": open,
    })}
    {open ? <DemoLoadBoundary onClose={() => { setOpen(false); openerRef.current?.focus(); }}>
      <Suspense fallback={<div role="status" className="mt-2 text-sm">Opening the sample… <button className="min-h-11 underline" type="button" onClick={() => setOpen(false)}>Cancel</button></div>}>
        <SyntheticDemo {...props} open={open} onOpenChange={setOpen} openerRef={openerRef} />
      </Suspense>
    </DemoLoadBoundary> : null}
  </>;
}
