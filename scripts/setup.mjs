import fs from "node:fs";
import path from "node:path";

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 5)) {
  console.warn(
    `[setup] Warning: Node.js ${process.versions.node} detected. Node.js >= 22.5.0 (recommended: 24 LTS) is required for built-in node:sqlite.`
  );
}

const root = process.cwd();
const envExamplePath = path.join(root, ".env.example");
const envLocalPath = path.join(root, ".env.local");

if (!fs.existsSync(envLocalPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envLocalPath);
  console.log("[setup] Created .env.local from .env.example (default local SQLite mode).");
}

const dataDir = path.join(root, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
