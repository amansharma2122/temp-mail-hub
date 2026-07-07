#!/usr/bin/env node
// CI guard: fails the build if any admin/hook/component code performs a
// direct write to the `app_settings` table instead of going through the
// deterministic `saveAppSetting` / `applyAppSettingsPatch` helpers (which
// route to the `upsert_app_setting` RPC).
//
// We scan `src/**/*.{ts,tsx}` (excluding tests, `src/lib/appSettingsSync.ts`
// itself, and the auto-generated Supabase files) for the anti-patterns:
//   .from('app_settings').upsert(
//   .from('app_settings').insert(
//   .from('app_settings').update(
//   api.db.upsert('app_settings' ...
//   api.db.insert('app_settings' ...
//   api.db.update('app_settings' ...
//
// Documentation code samples that live inside string literals (e.g.
// HostingGuide's `<CodeBlock code={`...`}/>`) are exempt via inline
// `// app-settings-guard-ignore` comments on the line above the write.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC = join(ROOT, "src");

const EXCLUDE_FILES = new Set([
  join(SRC, "lib", "appSettingsSync.ts"),
  join(SRC, "integrations", "supabase", "client.ts"),
  join(SRC, "integrations", "supabase", "types.ts"),
  // Documentation pages containing example code inside template literals.
  join(SRC, "pages", "HostingGuide.tsx"),
  join(SRC, "pages", "AdminGuide.tsx"),
  // Generic backend compat layer (routes to either Supabase or PHP).
  join(SRC, "lib", "api.ts"),
]);

const IGNORE_MARKER = "app-settings-guard-ignore";

const PATTERNS = [
  /\.from\(\s*["']app_settings["']\s*\)\s*\.\s*(?:upsert|insert|update)\s*\(/,
  /api\.db\.(?:upsert|insert|update)\s*\(\s*["']app_settings["']/,
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(p, out);
    } else if (/\.(?:ts|tsx)$/.test(entry) && !/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry)) {
      out.push(p);
    }
  }
  return out;
}

const violations = [];
for (const file of walk(SRC)) {
  if (EXCLUDE_FILES.has(file)) continue;
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!PATTERNS.some((re) => re.test(line))) continue;
    const prev = lines[i - 1] ?? "";
    if (prev.includes(IGNORE_MARKER)) continue;
    violations.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
  }
}

if (violations.length) {
  console.error("\n\u274c Direct app_settings writes detected.");
  console.error("   Use saveAppSetting / applyAppSettingsPatch from @/lib/appSettingsSync instead.\n");
  for (const v of violations) console.error("  - " + v);
  console.error(
    "\n   If a match is intentional (e.g. documentation snippet), add a\n" +
      `   \`// ${IGNORE_MARKER}\` comment on the line directly above.\n`,
  );
  process.exit(1);
}

console.log("\u2713 No direct app_settings writes detected.");