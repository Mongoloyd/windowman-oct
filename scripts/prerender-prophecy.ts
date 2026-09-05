/**
 * Post-build static loading document for /prophecy.
 *
 * This is deliberately an inert shell, not a server-rendered copy of the live
 * intake. React replaces it when the application starts.
 *
 * Also injects:
 * - First has_quote intent AVIF preload (LCP candidate)
 * - Manifest-resolved modulepreload for the hashed Prophecy route chunk
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

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
const headClosePattern = /<\/head>/i;

type ViteManifestEntry = {
  file: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
};

type ViteManifest = Record<string, ViteManifestEntry>;

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

const prophecyChunkHref = resolveProphecyChunkHref(loadManifest());

const prophecyHeadExtras =
  `  <style data-prophecy-prerender>html,body,#root{background:#070e18;color-scheme:dark}</style>\n` +
  `  <style data-prophecy-prerender-noscript>[data-prophecy-prerender-shell]{display:none!important}</style>\n` +
  `  <link rel="preload" as="image" type="image/avif" href="${FIRST_INTENT_AVIF}" fetchpriority="high" />\n` +
  `  <link rel="modulepreload" crossorigin href="${prophecyChunkHref}" />\n`;

const prophecyRoot = `<div id="root"><div data-prophecy-prerender-shell aria-hidden="true" class="flex min-h-screen items-center justify-center bg-[#070e18] px-5 text-slate-100 antialiased"><div class="text-center"><p class="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">WindowMan</p><p class="mt-3 text-sm text-slate-300">Preparing your independent estimate review…</p></div></div><noscript><div class="flex min-h-screen items-center justify-center bg-[#070e18] px-5 text-slate-100"><div class="max-w-lg text-center"><h1 class="text-2xl font-bold">JavaScript is required</h1><p class="mt-3 text-slate-300">Turn on JavaScript to use the WindowMan estimate review, or return to the WindowMan home page for more information.</p><a class="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-500 px-5 py-3 font-semibold text-slate-100" href="/">Return to WindowMan</a></div></div></noscript></div>`;

let shell = readFileSync(indexPath, "utf8");
if (!emptyRootPattern.test(shell)) {
  throw new Error("prerender: dist/index.html is missing the empty root target");
}
if (!headClosePattern.test(shell)) {
  throw new Error("prerender: dist/index.html is missing the head close tag");
}

shell = shell.replace(headClosePattern, `${prophecyHeadExtras}</head>`);
shell = shell.replace(emptyRootPattern, prophecyRoot);

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, shell, "utf8");
console.log(`prerender: wrote ${outPath}`);
console.log(`prerender: modulepreload ${prophecyChunkHref}`);
console.log(`prerender: image preload ${FIRST_INTENT_AVIF}`);
