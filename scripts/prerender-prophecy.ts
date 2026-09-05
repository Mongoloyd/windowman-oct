/**
 * Post-build static loading document for /prophecy.
 *
 * This is deliberately an inert shell, not a server-rendered copy of the live
 * intake. React replaces it when the application starts.
 *
 * Also injects:
 * - Route-specific SEO/social metadata (shared with runtime Helmet)
 * - First has_quote intent AVIF preload (LCP candidate)
 * - Manifest-resolved modulepreload for the hashed Prophecy route chunk
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  PROPHECY_METADATA,
} from "../src/content/prophecyMetadata.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "../dist");
const indexPath = resolve(distDir, "index.html");
const outDir = resolve(distDir, "prophecy");
const outPath = resolve(outDir, "index.html");
const manifestPath = resolve(distDir, ".vite/manifest.json");
const PROPHECY_ENTRY =
  "src/pages/CampaignProphecy/ProphecyLanding.tsx";
const FIRST_INTENT_AVIF = "/images/prophecy/intent-has-quote.avif";

const emptyRootPattern = /<div id="root">\s*<\/div>/;
const htmlOpenPattern = /<html\b([^>]*)>/i;
const headOpenPattern = /<head>/i;
const headClosePattern = /<\/head>/i;
const themeColorPattern =
  /<meta\b(?=[^>]*\bname=["']theme-color["'])[^>]*>/i;

type ViteManifestEntry = {
  file: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
};

type ViteManifest = Record<string, ViteManifestEntry>;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolveProphecyChunkHref(manifest: ViteManifest): string {
  const entry = manifest[PROPHECY_ENTRY];
  if (!entry?.file) {
    throw new Error(
      `prerender: Vite manifest is missing required entry "${PROPHECY_ENTRY}"`,
    );
  }

  const chunkPath = resolve(distDir, entry.file);
  if (!existsSync(chunkPath)) {
    throw new Error(
      `prerender: Prophecy chunk file missing on disk: ${entry.file}`,
    );
  }

  const href = entry.file.startsWith("/") ? entry.file : `/${entry.file}`;
  return href;
}

function loadManifest(): ViteManifest {
  if (!existsSync(manifestPath)) {
    throw new Error(
      `prerender: Vite build manifest missing at ${manifestPath}. Enable build.manifest in vite.config.ts.`,
    );
  }

  try {
    return JSON.parse(readFileSync(manifestPath, "utf8")) as ViteManifest;
  } catch (error) {
    throw new Error(
      `prerender: failed to parse Vite manifest at ${manifestPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function stripInheritedHomepageMetadata(html: string): string {
  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>\s*/i, "");
  out = out.replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, "");
  out = out.replace(/<meta\s+name=["']robots["'][^>]*>\s*/gi, "");
  out = out.replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, "");
  out = out.replace(/<meta\s+property=["']og:[^"']+["'][^>]*>\s*/gi, "");
  out = out.replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>\s*/gi, "");
  out = out.replace(
    /<script\s+type=["']application\/ld\+json["']>[\s\S]*?<\/script>\s*/gi,
    "",
  );
  return out;
}

function buildProphecyMetadataTags(): string {
  const m = PROPHECY_METADATA;
  return [
    `<title>${escapeHtml(m.title)}</title>`,
    `<meta name="description" content="${escapeHtml(m.description)}" />`,
    `<meta name="robots" content="${escapeHtml(m.robots)}" />`,
    `<link rel="canonical" href="${m.canonicalUrl}" />`,
    `<meta property="og:type" content="${escapeHtml(m.openGraph.type)}" />`,
    `<meta property="og:site_name" content="${escapeHtml(m.openGraph.siteName)}" />`,
    `<meta property="og:title" content="${escapeHtml(m.openGraph.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(m.openGraph.description)}" />`,
    `<meta property="og:url" content="${m.openGraph.url}" />`,
    `<meta property="og:image" content="${m.openGraph.image}" />`,
    `<meta name="twitter:card" content="${escapeHtml(m.twitter.card)}" />`,
    `<meta name="twitter:title" content="${escapeHtml(m.twitter.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(m.twitter.description)}" />`,
    `<meta name="twitter:image" content="${m.twitter.image}" />`,
  ].join("\n  ");
}

const prophecyChunkHref = resolveProphecyChunkHref(loadManifest());

const prophecyCriticalCss = `  <style data-prophecy-critical>
    html[data-wm-theme="prophecy"],
    html[data-wm-theme="prophecy"] body,
    html[data-wm-theme="prophecy"] #root {
      min-height: 100%;
      margin: 0;
      background: #070e18;
      color: #f1f5f9;
      color-scheme: dark;
    }
    [data-prophecy-prerender-shell] {
      box-sizing: border-box;
      display: flex;
      min-height: 100vh;
      min-height: 100dvh;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      background: #070e18;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      text-align: center;
    }
    [data-prophecy-prerender-brand] {
      margin: 0;
      color: #7dd3fc;
      font-size: .875rem;
      font-weight: 700;
      letter-spacing: .2em;
      text-transform: uppercase;
    }
    [data-prophecy-prerender-message] {
      margin: .75rem 0 0;
      color: #cbd5e1;
      font-size: .875rem;
    }
    [data-prophecy-noscript] {
      box-sizing: border-box;
      display: flex;
      min-height: 100vh;
      min-height: 100dvh;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      background: #070e18;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      text-align: center;
    }
    [data-prophecy-noscript] > div {
      max-width: 32rem;
    }
    [data-prophecy-noscript] h1 {
      margin: 0;
      font-size: 1.5rem;
    }
    [data-prophecy-noscript] p {
      margin: .75rem 0 0;
      color: #cbd5e1;
      line-height: 1.6;
    }
    [data-prophecy-noscript] a {
      display: inline-flex;
      min-height: 2.75rem;
      margin-top: 1.5rem;
      align-items: center;
      justify-content: center;
      padding: .75rem 1.25rem;
      border: 1px solid #64748b;
      border-radius: .5rem;
      color: #f1f5f9;
      font-weight: 600;
    }
  </style>
`;

const prophecyHeadExtras =
  `  ${buildProphecyMetadataTags()}\n` +
  `  <link rel="preload" as="image" type="image/avif" href="${FIRST_INTENT_AVIF}" fetchpriority="high" />\n` +
  `  <link rel="modulepreload" crossorigin href="${prophecyChunkHref}" />\n`;

const prophecyRoot = `<div id="root"><div data-prophecy-prerender-shell aria-hidden="true"><div><p data-prophecy-prerender-brand>WindowMan</p><p data-prophecy-prerender-message>Preparing your independent estimate review…</p></div></div><noscript><style>[data-prophecy-prerender-shell]{display:none!important}</style><div data-prophecy-noscript><div><h1>JavaScript is required</h1><p>Turn on JavaScript to use the WindowMan estimate review, or return to the WindowMan home page for more information.</p><a href="/">Return to WindowMan</a></div></div></noscript></div>`;

let shell = readFileSync(indexPath, "utf8");
if (!emptyRootPattern.test(shell)) {
  throw new Error("prerender: dist/index.html is missing the empty root target");
}
if (!headClosePattern.test(shell)) {
  throw new Error("prerender: dist/index.html is missing the head close tag");
}
if (!htmlOpenPattern.test(shell) || !headOpenPattern.test(shell)) {
  throw new Error("prerender: dist/index.html is missing its document shell");
}
if (!themeColorPattern.test(shell)) {
  throw new Error("prerender: dist/index.html is missing theme-color metadata");
}

shell = stripInheritedHomepageMetadata(shell);
shell = shell.replace(htmlOpenPattern, (_match, attributes: string) =>
  attributes.includes("data-wm-theme")
    ? `<html${attributes}>`
    : `<html${attributes} data-wm-theme="prophecy">`,
);
shell = shell.replace(
  themeColorPattern,
  '<meta name="theme-color" content="#070e18" data-default-content="#EBF0F6" />',
);
shell = shell.replace(headOpenPattern, `<head>\n${prophecyCriticalCss}`);
shell = shell.replace(headClosePattern, `${prophecyHeadExtras}</head>`);
shell = shell.replace(emptyRootPattern, prophecyRoot);

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, shell, "utf8");
console.log(`prerender: wrote ${outPath}`);
console.log(`prerender: modulepreload ${prophecyChunkHref}`);
console.log(`prerender: image preload ${FIRST_INTENT_AVIF}`);
