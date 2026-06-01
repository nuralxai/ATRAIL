const { build } = require("esbuild");
const path = require("path");

build({
  entryPoints: [path.join(__dirname, "src/index.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: path.join(__dirname, "dist/server.cjs"),
  external: [
    // Keep prisma and native addons external
    "@prisma/client",
    "prisma",
    // Sharp / canvas / native modules
    "canvas",
    "sharp",
    // tesseract native
    "tesseract.js",
    // firebase-admin uses native grpc
    "firebase-admin",
    "@google-cloud/firestore",
    "grpc",
    "@grpc/grpc-js",
    // keep fs/path/etc as node built-ins
  ],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  logLevel: "info",
  sourcemap: false,
}).then(() => {
  console.log("✅ Bundle built: dist/server.cjs");
}).catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
