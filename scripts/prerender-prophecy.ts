/**
 * Post-build static loading document for /prophecy.
 *
 * This is deliberately an inert shell, not a server-rendered copy of the live
 * intake. React replaces it when the application starts.
 */
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "../dist");
const indexPath = resolve(distDir, "index.html");
const outDir = resolve(distDir, "prophecy");
const outPath = resolve(outDir, "index.html");
const emptyRoot = '<div id="root"></div>';

const prophecyRoot = `<div id="root"><div data-prophecy-prerender-shell aria-hidden="true" class="flex min-h-screen items-center justify-center bg-[#070e18] px-5 text-slate-100 antialiased"><div class="text-center"><p class="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">WindowMan</p><p class="mt-3 text-sm text-slate-300">Preparing your independent estimate review…</p></div></div><noscript><div class="flex min-h-screen items-center justify-center bg-[#070e18] px-5 text-slate-100"><div class="max-w-lg text-center"><h1 class="text-2xl font-bold">JavaScript is required</h1><p class="mt-3 text-slate-300">Turn on JavaScript to use the WindowMan estimate review, or return to the WindowMan home page for more information.</p><a class="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-500 px-5 py-3 font-semibold text-slate-100" href="/">Return to WindowMan</a></div></div></noscript></div>`;

let shell = readFileSync(indexPath, "utf8");
if (!shell.includes(emptyRoot)) {
  throw new Error("prerender: dist/index.html is missing the empty root target");
}

shell = shell.replace(
  "</head>",
  "  <style data-prophecy-prerender>html,body,#root{background:#070e18;color-scheme:dark}</style>\n</head>",
);
shell = shell.replace(emptyRoot, prophecyRoot);

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, shell, "utf8");
console.log(`prerender: wrote ${outPath}`);

