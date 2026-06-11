#!/usr/bin/env node
// PostToolUse hook (Write|Edit): runs Prettier and ESLint --fix on the
// touched file. Never fails the parent tool call - errors are logged to
// stderr only.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const PRETTIER_EXTS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".md",
]);

const ESLINT_EXTS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);

function readStdin() {
  try {
    return readFileSync(0, "utf-8");
  } catch {
    return "";
  }
}

function run(cmd, args, cwd) {
  const isWin = process.platform === "win32";
  const result = spawnSync(cmd, args, {
    cwd,
    shell: isWin,
    encoding: "utf-8",
  });
  if (result.error) {
    console.error(`[format-file] ${cmd} failed to start: ${result.error.message}`);
  } else if (result.status !== 0) {
    console.error(`[format-file] ${cmd} exited with code ${result.status}`);
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
  }
}

const raw = readStdin();
let payload;
try {
  payload = JSON.parse(raw);
} catch {
  process.exit(0);
}

const filePath = payload?.tool_input?.file_path;
if (!filePath) {
  process.exit(0);
}

const ext = path.extname(filePath).toLowerCase();
const cwd = payload.cwd || process.cwd();

if (PRETTIER_EXTS.has(ext)) {
  run("npx", ["--no-install", "prettier", "--write", filePath], cwd);
}

if (ESLINT_EXTS.has(ext)) {
  run("npx", ["--no-install", "eslint", "--fix", filePath], cwd);
}

process.exit(0);
