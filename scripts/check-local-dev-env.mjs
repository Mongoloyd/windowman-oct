import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const requiredFiles = [
  ".env.local",
  "supabase/functions/.env",
];

const missingFiles = requiredFiles.filter((file) => !existsSync(file));

if (missingFiles.length > 0) {
  console.error("Local development cannot start.");
  console.error("Missing required ignored environment files:");
  for (const file of missingFiles) {
    console.error(`- ${file}`);
  }
  console.error(
    "Restore these files from the approved secret source. Do not copy unknown values from an old worktree.",
  );
  process.exit(1);
}

// Validate that VITE_SUPABASE_URL points to a local instance.
const envLocalPath = resolve(".env.local");
const envLocalContent = readFileSync(envLocalPath, "utf8");
const supabaseUrlMatch = envLocalContent.match(
  /^\s*VITE_SUPABASE_URL\s*=\s*(.+)$/m,
);
const supabaseUrl = supabaseUrlMatch ? supabaseUrlMatch[1].trim() : "";

if (!supabaseUrl) {
  console.error(
    "VITE_SUPABASE_URL is missing or empty in .env.local.\n" +
    "Set it to the local Supabase URL, e.g.: VITE_SUPABASE_URL=http://127.0.0.1:54321",
  );
  process.exit(1);
}

const isLocal =
  supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost");

if (!isLocal) {
  console.error(
    `VITE_SUPABASE_URL in .env.local points to a remote instance: ${supabaseUrl}\n` +
    "For local development, point VITE_SUPABASE_URL to the local Supabase URL, e.g.: http://127.0.0.1:54321\n" +
    "Do not run local dev tooling against a hosted Supabase project.",
  );
  process.exit(1);
}

console.log("Local environment-file preflight passed.");
