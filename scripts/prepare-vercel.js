const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const source = path.join(projectRoot, "frontend");
const destination = path.join(projectRoot, "public");

fs.mkdirSync(destination, { recursive: true });
fs.cpSync(source, destination, { recursive: true, force: true });
console.log("Copied frontend assets to public/ for Vercel static hosting.");
