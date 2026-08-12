import { Link } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";

type BrandLogoSize = "sm" | "md" | "lg" | "responsive";

interface BrandLogoProps {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  ariaLabel?: string;
  href?: string;
  to?: string;
  size?: BrandLogoSize;
  useRouterLink?: boolean;
  mark?: ReactNode;
}

const SIZE_CLASSES: Record<
  BrandLogoSize,
  {
    root: string;
    mark: string;
    wordmark: string;
    gap: string;
  }
> = {
  sm: {
    root: "max-w-none",
    mark: "text-[16px]",
    wordmark: "text-sm",
    gap: "gap-1.5",
  },
  md: {
    root: "max-w-none",
    mark: "text-[20px]",
    wordmark: "text-xl",
    gap: "gap-2",
  },
  lg: {
    root: "max-w-none",
    mark: "text-[24px]",
    wordmark: "text-2xl",
    gap: "gap-2.5",
  },
  responsive: {
    root: "max-w-[45%] sm:max-w-none",
    mark: "text-[16px] sm:text-[20px]",
    wordmark: "text-sm sm:text-xl",
    gap: "gap-1.5 sm:gap-2",
  },
};

const wordmarkStyle: CSSProperties = {
  fontWeight: 800,
  letterSpacing: "0.02em",
};

function BrandLogoContent({
  size,
  markClassName,
  wordmarkClassName,
  mark,
}: Required<Pick<BrandLogoProps, "size">> &
  Pick<BrandLogoProps, "markClassName" | "wordmarkClassName" | "mark">) {
  const classes = SIZE_CLASSES[size];

  return (
    <>
      <span className="relative inline-flex overflow-hidden">
        <span
          role="img"
          aria-label="shield"
          className={[
            classes.mark,
            "transition-all duration-300 group-hover:drop-shadow-[0_0_6px_rgba(37,99,235,0.7)]",
            markClassName,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {mark ?? "🛡️"}
        </span>
      </span>

      <span
        className={["font-display", classes.wordmark, wordmarkClassName ?? "text-foreground"].join(" ")}
        style={wordmarkStyle}
      >
        <span>WINDOW</span>
        <span style={{ color: "#448df7" }}>MAN</span>
      </span>
    </>
  );
}

export default function BrandLogo({
  href = "/",
  to,
  size = "responsive",
  className,
  markClassName,
  wordmarkClassName,
  ariaLabel = "WindowMan.app home",
  useRouterLink = false,
  mark,
}: BrandLogoProps) {
  const classes = SIZE_CLASSES[size];

  const rootClassName = [
    "select-none group relative inline-flex items-center",
    classes.gap,
    classes.root,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <BrandLogoContent
      size={size}
      mark={mark}
      markClassName={markClassName}
      wordmarkClassName={wordmarkClassName}
    />
  );

  if (useRouterLink || to) {
    return (
      <Link to={to ?? href} className={rootClassName} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }

  return (
    <a href={href} className={rootClassName} aria-label={ariaLabel}>
      {content}
    </a>
  );
}
