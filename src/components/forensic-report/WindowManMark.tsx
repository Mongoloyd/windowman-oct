/**
 * WindowManMark — purely presentational mark/watermark.
 *
 * Abstract 4-pane window silhouette. No face, no mascot, no animation.
 * Pure SVG, aria-hidden, no data, no state, no external dependencies.
 * Intended as a subtle WindowMan presence on the FOG hero.
 */
interface Props {
  size?: number;
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function WindowManMark({
  size = 32,
  opacity = 0.18,
  className,
  style,
}: Props) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        opacity,
        color: "currentColor",
        lineHeight: 0,
        ...style,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="square"
      >
        <rect x="4" y="4" width="24" height="24" rx="1" />
        <line x1="16" y1="4" x2="16" y2="28" />
        <line x1="4" y1="16" x2="28" y2="16" />
      </svg>
    </div>
  );
}
