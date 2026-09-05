/**
 * AdminGlobalNav — persistent, links-only operator navigation.
 *
 * xl+: five primary destinations plus More.
 * Below xl: hamburger drawer with the same destinations.
 *
 * Active state uses pathname-only metadata from adminDashboardTabs.
 * No search, badges, or horizontal scrolling.
 */

import { useEffect, useRef, useState, type ElementType, type KeyboardEvent } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  BarChart3,
  FileSearch,
  GitBranch,
  Handshake,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Menu,
  MoreHorizontal,
  PhoneCall,
  Route,
  Settings,
  Users,
} from "lucide-react";
import {
  getAdminMoreDestinations,
  getAdminPrimaryDestinations,
  isAdminMoreTriggerActive,
  resolveAdminGlobalDestination,
  type AdminGlobalDestination,
  type AdminGlobalDestinationId,
} from "@/routes/adminDashboardTabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const DESTINATION_ICONS: Record<AdminGlobalDestinationId, ElementType> = {
  "lead-inbox": Inbox,
  "command-center": LayoutDashboard,
  pipeline: GitBranch,
  routing: Route,
  "needs-review": ListChecks,
  contractors: Users,
  attribution: BarChart3,
  "otp-ops": PhoneCall,
  evidence: FileSearch,
  partners: Handshake,
  settings: Settings,
  health: HeartPulse,
  "meta-intake-lab": Activity,
};

const LINK_CLASSES = [
  "inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-none",
  "border-0 border-b-2 px-2.5 py-1 text-sm font-bold transition-colors",
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2",
].join(" ");

const INACTIVE_CLASSES =
  "border-b-transparent bg-transparent text-[#cad7e4] hover:bg-[#142a3e] hover:text-[#f7fbff]";

const ACTIVE_CLASSES =
  "border-b-[#2384ee] bg-transparent text-[#f7fbff] font-black";

const DRAWER_LINK_CLASSES = [
  "inline-flex min-h-[44px] w-full items-center gap-2 rounded-md border border-[#3b5874] px-3 text-sm font-bold",
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2",
].join(" ");

function destinationIsActive(
  destination: AdminGlobalDestination,
  activeId: AdminGlobalDestinationId | undefined,
) {
  return activeId === destination.id;
}

function MoreMenu({
  destinations,
  activeId,
  moreActive,
}: {
  destinations: AdminGlobalDestination[];
  activeId?: AdminGlobalDestinationId;
  moreActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const closeAndRestore = () => {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      window.setTimeout(() => itemRefs.current[0]?.focus(), 0);
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeAndRestore();
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter((node): node is HTMLAnchorElement => Boolean(node));
    const currentIndex = items.findIndex((node) => node === document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestore();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(currentIndex + 1 + items.length) % items.length]?.focus();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    }
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className={`${LINK_CLASSES} ${moreActive ? ACTIVE_CLASSES : INACTIVE_CLASSES}`}
        aria-label="More admin destinations"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
      >
        <MoreHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>More</span>
        {moreActive ? <span className="sr-only"> (current section)</span> : null}
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          data-testid="admin-more-menu"
          className="wm-admin-portal absolute right-0 z-50 mt-1 min-w-56 rounded-md border border-[#2b435b] bg-[#102130] p-1 shadow-md"
          onKeyDown={onMenuKeyDown}
        >
          {destinations.map((destination, index) => {
            const Icon = DESTINATION_ICONS[destination.id];
            const isActive = destinationIsActive(destination, activeId);
            return (
              <NavLink
                key={destination.id}
                to={destination.href}
                role="menuitem"
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-sm px-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${
                  isActive
                    ? "bg-[#0a2947] text-[#a9d4ff]"
                    : "text-[#e7f0f9] hover:bg-[#142a3e] hover:text-[#f7fbff]"
                }`}
                onClick={closeAndRestore}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{destination.label}</span>
                {isActive ? <span className="sr-only"> (current section)</span> : null}
              </NavLink>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function DestinationLink({
  destination,
  activeId,
  onNavigate,
  className,
}: {
  destination: AdminGlobalDestination;
  activeId?: AdminGlobalDestinationId;
  onNavigate?: () => void;
  className?: string;
}) {
  const Icon = DESTINATION_ICONS[destination.id];
  const isActive = destinationIsActive(destination, activeId);

  return (
    <NavLink
      to={destination.href}
      className={`${className ?? LINK_CLASSES} ${isActive ? ACTIVE_CLASSES : INACTIVE_CLASSES}`}
      aria-current={isActive ? "page" : undefined}
      onClick={onNavigate}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{destination.label}</span>
      {isActive ? <span className="sr-only"> (current section)</span> : null}
    </NavLink>
  );
}

export function AdminGlobalNav({
  variant: _variant = "default",
}: {
  variant?: "default" | "lead-dossier" | "lead-inbox";
}) {
  void _variant;
  const location = useLocation();
  const active = resolveAdminGlobalDestination(location.pathname);
  const moreActive = isAdminMoreTriggerActive(location.pathname);
  const primaryDestinations = getAdminPrimaryDestinations();
  const moreDestinations = getAdminMoreDestinations();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);

  const restoreFocus = (node: HTMLElement | null) => {
    window.setTimeout(() => node?.focus(), 0);
  };

  return (
    <nav aria-label="Admin sections" className="wm-admin-global-nav">
      <div
        data-testid="admin-desktop-nav"
        className="wm-admin-global-nav--desktop hidden min-w-0 items-center gap-2 xl:flex"
      >
        {primaryDestinations.map((destination) => (
          <DestinationLink
            key={destination.id}
            destination={destination}
            activeId={active?.id}
          />
        ))}

        <MoreMenu
          destinations={moreDestinations}
          activeId={active?.id}
          moreActive={moreActive}
        />
      </div>

      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) restoreFocus(drawerTriggerRef.current);
        }}
      >
        <SheetTrigger asChild>
          <button
            ref={drawerTriggerRef}
            type="button"
            className={`${LINK_CLASSES} ${INACTIVE_CLASSES} xl:hidden`}
            aria-label="Open admin navigation"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
            <span>Menu</span>
          </button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="wm-admin-portal wm-admin-mobile-drawer w-80 border-[#2b435b] bg-[#0c1b29] p-4 text-[#f7fbff]"
          data-testid="admin-mobile-drawer"
        >
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-[#f7fbff]">Admin navigation</SheetTitle>
            <SheetDescription className="text-[#cad7e4]">
              Primary destinations and More utilities.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#85bfff]">
              Primary
            </p>
            {primaryDestinations.map((destination) => (
              <DestinationLink
                key={`drawer-primary-${destination.id}`}
                destination={destination}
                activeId={active?.id}
                onNavigate={() => setDrawerOpen(false)}
                className={DRAWER_LINK_CLASSES}
              />
            ))}
            <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.16em] text-[#85bfff]">
              More
            </p>
            {moreDestinations.map((destination) => (
              <DestinationLink
                key={`drawer-more-${destination.id}`}
                destination={destination}
                activeId={active?.id}
                onNavigate={() => setDrawerOpen(false)}
                className={DRAWER_LINK_CLASSES}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
