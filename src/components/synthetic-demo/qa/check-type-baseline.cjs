/* Read-only comparison: HEAD sources are supplied in memory, never checked out. */
const ts = require("typescript");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = process.cwd();
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }).trim();
if (process.platform === "win32" && path.resolve(root).toLowerCase() !== "c:\\projects\\wm-mvp-github-clean") throw new Error("Wrong checkout");
const config = ts.readConfigFile("tsconfig.app.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const key = (file) => path.resolve(file).replace(/\\/g, "/").toLowerCase();
const changed = git("diff", "--name-only", "--diff-filter=M").split("\n").filter((file) => /\.tsx?$/.test(file));
const originals = new Map(changed.map((file) => [key(file), git("show", `HEAD:${file}`)]));
const tracked = git("ls-files", "src").split("\n").filter((file) => /\.tsx?$/.test(file)).map((file) => path.resolve(file));
function diagnostics(baseline) {
  const host = ts.createCompilerHost(parsed.options);
  const readSource = host.getSourceFile.bind(host);
  if (baseline) host.getSourceFile = (file, languageVersion, onError, createNew) => originals.has(key(file))
    ? ts.createSourceFile(file, originals.get(key(file)), languageVersion, true)
    : readSource(file, languageVersion, onError, createNew);
  const program = ts.createProgram(baseline ? tracked : parsed.fileNames, parsed.options, host);
  return ts.getPreEmitDiagnostics(program).map((item) => ({
    file: item.file ? path.relative(root, item.file.fileName).replace(/\\/g, "/") : "config",
    code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, " "),
  }));
}
const before = diagnostics(true);
const after = diagnostics(false);
const beforeSet = new Set(before.map((item) => JSON.stringify(item)));
const afterSet = new Set(after.map((item) => JSON.stringify(item)));
const introduced = after.filter((item) => !beforeSet.has(JSON.stringify(item)));
const resolved = before.filter((item) => !afterSet.has(JSON.stringify(item)));
console.log(JSON.stringify({ baseline: git("rev-parse", "HEAD"), baselineDiagnostics: before.length,
  currentDiagnostics: after.length, introduced, resolved }, null, 2));
process.exitCode = introduced.length ? 1 : 0;
