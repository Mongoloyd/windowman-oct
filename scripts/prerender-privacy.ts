/**
 * Post-build static HTML for /privacy (crawler-readable before JS).
 */
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HelmetProvider } from "react-helmet-async";
import { PrivacyPolicyBody } from "../src/components/privacy/PrivacyPolicyBody.tsx";
import {
  PRIVACY_POLICY_DESCRIPTION,
  PRIVACY_POLICY_JSON_LD,
  PRIVACY_POLICY_TITLE,
  PRIVACY_POLICY_URL,
} from "../src/content/privacyPolicyMetadata.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, "../dist");
const indexPath = resolve(distDir, "index.html");
const outDir = resolve(distDir, "privacy");
const outPath = resolve(outDir, "index.html");

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function replaceOrInsert(
  html: string,
  pattern: RegExp,
  replacement: string,
): string {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html.replace("</head>", `${replacement}\n</head>`);
}

function buildPrivacyHeadTags(): string {
  const jsonLd = JSON.stringify(PRIVACY_POLICY_JSON_LD);
  return [
    `<title>${escapeHtml(PRIVACY_POLICY_TITLE)}</title>`,
    `<meta name="description" content="${escapeHtml(PRIVACY_POLICY_DESCRIPTION)}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    `<link rel="canonical" href="${PRIVACY_POLICY_URL}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="WindowMan" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:title" content="${escapeHtml(PRIVACY_POLICY_TITLE)}" />`,
    `<meta property="og:description" content="${escapeHtml(PRIVACY_POLICY_DESCRIPTION)}" />`,
    `<meta property="og:url" content="${PRIVACY_POLICY_URL}" />`,
    `<meta property="og:image" content="https://windowman.app/og-wman.png" />`,
    `<meta property="og:image:secure_url" content="https://windowman.app/og-wman.png" />`,
    `<meta property="og:image:type" content="image/png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="WindowMan" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${escapeHtml(PRIVACY_POLICY_TITLE)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(PRIVACY_POLICY_DESCRIPTION)}" />`,
    `<meta name="twitter:image" content="https://windowman.app/og-wman.png" />`,
    `<meta name="twitter:image:alt" content="WindowMan" />`,
    `<script type="application/ld+json">${jsonLd}</script>`,
  ].join("\n    ");
}

function stripConflictingHead(html: string): string {
  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>\s*/i, "");
  out = out.replace(
    /<meta\s+name="description"[^>]*>\s*/gi,
    "",
  );
  out = out.replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "");
  out = out.replace(/<meta\s+property="og:[^"]+"[^>]*>\s*/gi, "");
  out = out.replace(/<meta\s+name="twitter:[^"]+"[^>]*>\s*/gi, "");
  out = out.replace(
    /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi,
    "",
  );
  return out;
}

const helmetContext: { helmet?: { title?: { toString(): string } } } = {};

const bodyMarkup = renderToStaticMarkup(
  React.createElement(
    HelmetProvider,
    { context: helmetContext },
    React.createElement(
      "div",
      {
        className:
          "relative min-h-screen overflow-hidden pb-32",
        style: {
          background:
            "linear-gradient(170deg, #dce8f4 0%, #e4edf6 30%, #eaeff8 60%, #dde6f2 100%)",
        },
      },
      React.createElement(PrivacyPolicyBody, { contentOnly: true }),
    ),
  ),
);

let shell = readFileSync(indexPath, "utf8");
shell = stripConflictingHead(shell);
const privacyHead = buildPrivacyHeadTags();
shell = replaceOrInsert(shell, /<\/head>/i, `    ${privacyHead}\n  </head>`);

shell = shell.replace(
  /<div id="root"><\/div>/,
  `<div id="root">${bodyMarkup}</div>`,
);

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, shell, "utf8");
console.log(`prerender: wrote ${outPath}`);
