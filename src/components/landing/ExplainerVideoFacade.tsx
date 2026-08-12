import { useState } from "react";
import { Play } from "lucide-react";

export interface NativeExplainerVideoSource {
  readonly kind: "native";
  readonly src: string;
  readonly mimeType?: "video/mp4" | "video/webm";
}

export interface BunnyExplainerVideoSource {
  readonly kind: "bunny";
  readonly embedUrl: string;
}

export type ExplainerVideoSource =
  | NativeExplainerVideoSource
  | BunnyExplainerVideoSource;

export interface ExplainerVideoFacadeProps {
  readonly poster: string;
  readonly posterAvif?: string;
  readonly source: ExplainerVideoSource;
  readonly title: string;
}

interface ExplainerVideoSectionProps {
  readonly zipInputId: string;
  readonly headline?: string;
  readonly supportingCopy?: string;
}

const DEFAULT_HEADLINE = "See what your written estimate is really saying.";
const DEFAULT_SUPPORTING_COPY =
  "WindowMan turns a contractor estimate into a structured review of price, scope, fees, warranty language, and fine print—so you can see what deserves a closer look.";

const LOW_FETCH_PRIORITY_ATTR = { fetchpriority: "low" } as Record<string, string>;

const EXPLAINER_POSTER = "/images/windowman-explainer-poster.webp";
const EXPLAINER_POSTER_AVIF = "/images/windowman-explainer-poster.avif";
const EXPLAINER_VIDEO_SOURCE: NativeExplainerVideoSource = {
  kind: "native",
  src: "/media/windowman-explainer-60s.mp4",
  mimeType: "video/mp4",
};

function getBunnyEmbedSrc(embedUrl: string) {
  const separator = embedUrl.includes("?") ? "&" : "?";
  return `${embedUrl}${separator}autoplay=true&playsinline=true`;
}

export function ExplainerVideoFacade({
  poster,
  posterAvif,
  source,
  title,
}: ExplainerVideoFacadeProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_6px_10px_rgba(2,6,23,0.6),0_30px_80px_rgba(2,6,23,0.58)]"
      data-testid="explainer-video-facade"
    >
      {isPlaying ? (
        source.kind === "native" ? (
          <video
            className="h-full w-full bg-black object-contain"
            controls
            autoPlay
            playsInline
            preload="metadata"
            poster={poster}
            aria-label={title}
            data-testid="explainer-video"
          >
            <source src={source.src} type={source.mimeType ?? "video/mp4"} />
          </video>
        ) : (
          <iframe
            className="h-full w-full border-0"
            src={getBunnyEmbedSrc(source.embedUrl)}
            title={title}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            data-testid="explainer-video-iframe"
          />
        )
      ) : (
        <>
          <picture>
            {posterAvif ? <source srcSet={posterAvif} type="image/avif" /> : null}
            <img
              className="h-full w-full object-cover"
              src={poster}
              alt="A written window estimate being scanned for analysis"
              width={1280}
              height={720}
              loading="lazy"
              decoding="async"
              // React 18 does not recognise camelCase fetchPriority and warns, so
              // pass the attribute already lowercased. Same DOM output, no warning.
              {...LOW_FETCH_PRIORITY_ATTR}
            />
          </picture>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-black/15"
            aria-hidden="true"
          />
          <button
            className="group absolute inset-0 flex cursor-pointer items-center justify-center focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-400/80 focus-visible:ring-inset"
            type="button"
            aria-label={`Play ${title}`}
            onClick={() => setIsPlaying(true)}
          >
            <span className="flex h-16 w-16 min-h-12 min-w-12 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white shadow-xl backdrop-blur-md transition duration-200 group-hover:scale-105 group-hover:bg-black/55 group-focus-visible:scale-105 motion-reduce:transition-none">
              <Play className="ml-1 h-7 w-7 fill-current" aria-hidden="true" />
            </span>
          </button>
          <span className="pointer-events-none absolute bottom-4 left-4 rounded-md border border-white/15 bg-black/55 !px-2.5 !py-1 text-xs font-semibold tracking-wide text-white backdrop-blur-md">
            60 seconds
          </span>
        </>
      )}
    </div>
  );
}

export function ExplainerVideoSection({
  zipInputId,
  headline = DEFAULT_HEADLINE,
  supportingCopy = DEFAULT_SUPPORTING_COPY,
}: ExplainerVideoSectionProps) {
  return (
    <section
      className="!border-y !border-white/10 !bg-slate-950 !py-14 sm:!py-20 [content-visibility:auto] [contain-intrinsic-size:720px]"
      aria-labelledby="explainer-video-heading"
      data-testid="explainer-video-section"
    >
      <div className="!mx-auto grid max-w-6xl items-center gap-10 !px-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-14">
        <div>
          <p className="!mb-4 inline-flex rounded-full border border-sky-400/25 bg-sky-400/10 !px-3 !py-1.5 !text-[11px] font-bold uppercase tracking-[0.14em] text-sky-200">
            AI quote intelligence · 60-sec overview
          </p>
          <h2
            className="!mb-4 !text-3xl !font-extrabold !leading-tight !tracking-[-0.03em] text-white sm:!text-4xl"
            id="explainer-video-heading"
          >
            {headline}
          </h2>
          <p className="!m-0 max-w-xl text-base leading-7 text-slate-300">
            {supportingCopy}
          </p>

          <ol className="!mt-7 grid gap-3" aria-label="How the service helps">
            <li className="grid grid-cols-[2rem_1fr] gap-3 rounded-xl border border-white/10 bg-slate-900/60 !p-4 text-sm leading-6 text-slate-300">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-400/15 font-bold text-sky-300" aria-hidden="true">
                1
              </span>
              <span>
                See how our AI scans line items, scope gaps, and Florida Product
                Approvals.
              </span>
            </li>
            <li className="grid grid-cols-[2rem_1fr] gap-3 rounded-xl border border-white/10 bg-slate-900/60 !p-4 text-sm leading-6 text-slate-300">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-400/15 font-bold text-sky-300" aria-hidden="true">
                2
              </span>
              <span>
                No written estimate yet? Use the{" "}
                <a
                  className="font-semibold text-sky-300 underline decoration-sky-300/45 underline-offset-4 hover:text-sky-200"
                  href={`#${zipInputId}`}
                >
                  ZIP code above
                </a>{" "}
                to start with a first written estimate we can analyze.
              </span>
            </li>
          </ol>
        </div>

        <ExplainerVideoFacade
          poster={EXPLAINER_POSTER}
          posterAvif={EXPLAINER_POSTER_AVIF}
          source={EXPLAINER_VIDEO_SOURCE}
          title="How WindowMan checks a window estimate"
        />
      </div>
    </section>
  );
}
