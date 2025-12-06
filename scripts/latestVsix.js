// scripts/latestVsix.js
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");

if (!fs.existsSync(distDir)) {
  console.error("dist folder does not exist");
  process.exit(1);
}

const files = fs
  .readdirSync(distDir)
  .filter((f) => f.endsWith(".vsix"))
  .map((f) => ({
    name: f,
    time: fs.statSync(path.join(distDir, f)).mtime.getTime(),
  }))
  .sort((a, b) => b.time - a.time);

if (files.length === 0) {
  console.error("No VSIX found in dist/");
  process.exit(1);
}

process.stdout.write(path.join(distDir, files[0].name));
