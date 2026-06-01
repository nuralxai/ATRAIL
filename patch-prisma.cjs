// Runs on the SERVER as: node patch-prisma.cjs
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const API_SRC = "/var/www/atrail/apps/api/src";

// Find all TypeScript files that import from @prisma/client
let files = [];
try {
  const result = execSync(`grep -rl "@prisma/client" ${API_SRC}/ 2>/dev/null`).toString().trim();
  files = result.split("\n").filter(Boolean);
} catch {
  console.log("No files import @prisma/client");
}

console.log(`Found ${files.length} files to patch:`);

for (const file of files) {
  // Calculate relative path from file to src/generated/client/index.js
  const fileDir = path.dirname(file);
  const targetPath = path.join(API_SRC, "generated", "client", "index.js");
  let relativePath = path.relative(fileDir, targetPath);
  // Ensure forward slashes
  relativePath = relativePath.replace(/\\/g, "/");
  if (!relativePath.startsWith(".")) relativePath = "./" + relativePath;

  let content = fs.readFileSync(file, "utf8");
  const before = content;
  content = content
    .replace(/from '@prisma\/client'/g, `from '${relativePath}'`)
    .replace(/from "@prisma\/client"/g, `from "${relativePath}"`);
  fs.writeFileSync(file, content);

  if (content !== before) {
    console.log(`  ✅ Patched: ${path.relative(API_SRC, file)} → ${relativePath}`);
  }
}

// Final scan
try {
  const remaining = execSync(`grep -rn "@prisma/client" ${API_SRC}/ 2>/dev/null`).toString().trim();
  if (remaining) {
    console.log("\n⚠️  REMAINING imports:", remaining);
  } else {
    console.log("\n✅ All @prisma/client imports replaced with local generated client!");
  }
} catch {
  console.log("\n✅ All @prisma/client imports replaced!");
}
