// Entry point for hosts that need a single start file (Hostinger Node.js Web App).
// Runs the Next.js standalone server produced by `npm run build`.
const fs = require("fs");
const path = require("path");

// Load a root .env if the host does not inject variables itself. Real env vars win.
const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
}
process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
process.chdir(path.join(__dirname, ".next", "standalone"));
require("./.next/standalone/server.js");
