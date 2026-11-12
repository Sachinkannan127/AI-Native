const fs = require("node:fs");
const path = require("node:path");

const src = path.join(__dirname, "public");
const dest = path.join(__dirname, "dist");

try {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log("Build completed successfully: assets copied from public/ to dist/");
} catch (err) {
  console.error("Build failed:", err);
  process.exit(1);
}

